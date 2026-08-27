/**
 * Section: SSA form.
 *
 * The measurement is what construction does to a loop. `let t = 0; for v in
 * [1,2,3] { t = t + v; }` has a slot written in two places, so the iterated
 * dominance frontier of those two blocks is the loop header, and that is where
 * the phi goes. Reading the placement beside the frontier that justified it is
 * the point: a phi is not a trick, it is the only way to name a value that
 * depends on which edge arrived.
 *
 * The second is destruction. The swap case — two phis exchanging values, which
 * become two copies that in either order both end up with the same value — is
 * built by hand, because Berugo cannot produce it: writing a swap needs a third
 * variable, and that variable breaks the cycle before SSA sees it. The
 * sequencer still has to be right, so it is exercised rather than left as an
 * untested branch, and the table says which row is the constructed one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'ssa-form';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a phi at a join, and why nothing else will do',
      caption: 'Two paths define `t` and both reach the header. In SSA every register has ' +
        'exactly one definition, so neither definition can be "the" value of `t` there — and ' +
        'the phi is the third definition that says which. It is not an instruction the machine ' +
        'runs; it is a note that the value depends on the edge, and destruction turns it back ' +
        'into copies in the predecessors. The reason to go through this is the arrow on the ' +
        'right: after construction, "the definition of this value" is a pointer rather than a ' +
        'search, and nearly every optimisation in this milestone is stated in exactly those ' +
        'terms.',
      definition: [
        'graph TD',
        'E["entry: t0 = 0"] --> H["header"]',
        'L["latch: t2 = add t1, v"] --> H',
        'H --> P["t1 = phi [entry: t0] [latch: t2]"]',
        'P --> U["every use of t in the loop reads t1"]',
        'U --> D["and the definition of t1 is one pointer away"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Single assignment: every register is defined exactly once, anywhere in the ' +
        'function.** That makes "the definition of this value" a pointer rather than a search, ' +
        'and it is the reason nearly every modern optimisation is stated in terms of SSA — ' +
        'copy propagation, value numbering and dead-code elimination each become a few dozen ' +
        'lines and would each need a dataflow analysis without it.',
      '**A phi function is what the property costs at a join.** Two paths define a variable ' +
        'and both reach a block, so neither definition can be the one; the phi is a third that ' +
        'names the edge. It is not executable in the ordinary sense — no machine has the ' +
        'instruction — and destruction turns it back into copies before code generation.',
      '**Placement is the iterated dominance frontier of the blocks that write the ' +
        'variable.** Not the frontier once: inserting a phi is itself a definition, so it can ' +
        'force another one further down. Iterating to a fixpoint is Cytron\'s algorithm and it ' +
        'is why 29.3 had to come first.',
      '**Renaming is a walk of the DOMINATOR tree with a stack per variable.** Push on a ' +
        'definition, pop on the way out. Because the walk follows dominance rather than ' +
        'control flow, the top of the stack at any point is exactly the definition that ' +
        'reaches there — which is the whole reason the tree is the right thing to walk.',
      '**Pruned SSA drops the phis nothing reads, and on a loop that is most of them.** A ' +
        'minimal construction places a phi wherever the frontier says one could be needed; ' +
        'many are then read by nothing. Removing one can make another dead, so the pass is a ' +
        'fixpoint, and the two counts are reported because the difference is the whole of ' +
        '"minimal versus pruned".',
      '**Memory sits outside the property, and that is the exception that shapes everything ' +
        'after it.** A register has one definition; a heap location does not. So loads and ' +
        'stores keep their own machinery, alias analysis exists to reason about them, and 29.9 ' +
        'is a whole section about the gap. Promoting locals to registers is exactly the work ' +
        'of moving as much as possible OUT of that gap.',
      '**Destruction must split critical edges first.** A phi operand becomes a copy in the ' +
        'predecessor that supplies it, and if that predecessor has another successor the copy ' +
        'runs on a path it should not. That is why 29.2 splits them as a prophylactic rather ' +
        'than when a pass discovers it needs one.',
      '**The swap problem is the reason destruction sequences its copies — and no Berugo ' +
        'program produces it.** Two phis whose operands are each other become two moves, and ' +
        'in either order both registers end up with the same value; a temporary breaks the ' +
        'cycle. Writing a swap in Berugo needs a third variable, and that variable breaks the ' +
        'cycle before SSA sees it, so the case is exercised against a pair built by hand. ' +
        'A branch that never fires on any real input is still a branch that has to be right.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — placement, renaming, pruning and destruction',
        markup: root.SsaTemplate.render()
      },
      diagram: diagram(),
      insight: '**SSA makes def–use chains explicit, which is why nearly every modern ' +
        'optimisation is stated in terms of it; the cost is that memory operations sit outside ' +
        'the property and need their own machinery.** The first half is the reason the form ' +
        'won. Ask "what is the definition of this value" in a non-SSA IR and the answer is a ' +
        'reaching-definitions analysis — a fixpoint over the whole function, recomputed after ' +
        'every change. In SSA it is one pointer, valid by construction, and it stays valid ' +
        'because a pass that breaks it breaks a checkable invariant. That converts a class of ' +
        'analyses into lookups. The second half is where the form stops helping, and it is ' +
        'worth being precise about: SSA says a REGISTER has one definition. It says nothing ' +
        'about a heap location, so the moment a value lives in memory the chain is broken and ' +
        'the question becomes an aliasing one. That is why promoting locals to registers is ' +
        'the first thing construction does, why languages that make aliasing provable generate ' +
        'better code, and why the last analysis in this milestone is the one every compiler ' +
        'gives up on first.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SsaTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /**
   * Each stage is built from scratch rather than by mutating the last, so the
   * three views really are three stages of one compilation and not one program
   * progressively damaged by switching the control back and forth.
   */
  const stageFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const source = root.SsaTemplate.SAMPLES[parts[0]];
    const program = root.Berugo.IrLower.compile(source).program;
    const fn = program.functions[0];
    const before = root.Berugo.Ir.showFunction(fn);
    const placement = placementOf(fn);
    const stats = root.Berugo.Ssa.construct(fn, { prune: parts[1] });

    return finishStage(program, fn, before, placement, stats, parts[2]);
  });

  /** The frontier that justifies each phi, computed before construction runs. */
  function placementOf(fn) {
    const graph = root.Berugo.Cfg.build(fn);
    const tree = root.Berugo.Dominators.compute(graph);

    return (fn.slots || []).map(function (slot) {
      const writes = root.Berugo.Ssa.writesOf(fn, slot.name);

      return { slot: slot.name, source: slot.source, writes: writes,
        frontier: writes.length
          ? root.Berugo.Dominators.iteratedFrontier(tree, writes) : [] };
    }).filter(function (row) { return row.frontier.length; });
  }

  function finishStage(program, fn, before, placement, stats, stage) {
    const after = root.Berugo.Ir.showFunction(fn);
    const check = root.Berugo.Ssa.check(fn);
    const copy = root.Berugo.Ir.cloneFunction(fn);
    const destructed = root.Berugo.Ssa.destruct(copy);

    return { fn: fn, stats: stats, check: check, placement: placement,
      text: stage === 'before' ? before
        : (stage === 'after' ? after : root.Berugo.Ir.showFunction(copy)),
      stage: stage, destructed: destructed, program: program,
      phis: collectPhis(fn) };
  }

  function collectPhis(fn) {
    const rows = [];

    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst) {
        if (inst.op !== 'phi') return;
        rows.push({ block: block.id, text: root.Berugo.Ir.showInstruction(inst),
          slot: inst.slot });
      });
    });
    return rows;
  }

  const suiteFor = root.Helpers.memoise(function (prune) {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const program = root.Berugo.IrLower.compile(entry.source).program;
      const fn = program.functions[0];
      const base = root.Berugo.IrInterp.run(program);
      const stats = root.Berugo.Ssa.construct(fn, { prune: prune === 'true' });

      program.functions.slice(1).forEach(function (other) {
        root.Berugo.Ssa.construct(other, { prune: prune === 'true' });
      });
      return suiteRow(entry, program, fn, base, stats);
    });
  });

  function suiteRow(entry, program, fn, base, stats) {
    const check = root.Berugo.Ssa.check(fn);
    const verified = root.Berugo.Ir.verifyProgram(program, { ssa: true });
    const copy = root.Berugo.Ir.cloneFunction(fn);
    const destructed = root.Berugo.Ssa.destruct(copy);

    return { id: entry.id, placed: stats.placed, pruned: stats.pruned, phis: stats.phis,
      instructions: root.Berugo.Ir.instructionCount(fn),
      registers: fn.nextRegister, single: verified.ok, dominated: check.ok,
      moves: destructed.moves, temporaries: destructed.temporaries,
      agrees: root.Berugo.IrInterp.compare(base, root.Berugo.IrInterp.run(program)).agree };
  }

  function update() {
    const values = panel.values();
    const state = stageFor(JSON.stringify([values['ss-sample'],
      Boolean(values['ss-prune']), values['ss-stage']]));

    paintListing(state);
    paintMetrics(state);
    paintPhis(state);
    paintPruning(String(Boolean(values['ss-prune'])));
    paintDestruction(String(Boolean(values['ss-prune'])));
    paintCheck(String(Boolean(values['ss-prune'])));
  }

  function paintListing(state) {
    root.AstView.render(document.getElementById('ss-listing'),
      '<pre class="ir-listing">' +
      root.CfgView.escapeHtml(state.text) + '</pre>');

    root.Helpers.setText('ss-listing-caption', listingCaption(state));
  }

  function listingCaption(state) {
    if (state.stage === 'before') {
      return 'Named locals are `@n` slots, read with `load` and written with `store`. Every ' +
        'def–use relationship is hidden behind memory here, which is exactly what construction ' +
        'undoes.';
    }
    if (state.stage === 'after') {
      return 'The slots are gone. Each `load` became a copy of whichever definition reaches ' +
        'it, and where two could, a phi names the edge. The copies are what copy propagation ' +
        'removes in 29.6 — construction deliberately leaves them rather than trying to be ' +
        'clever, because a simple construction plus a simple cleanup is easier to get right ' +
        'than one pass doing both.';
    }
    return 'After destruction: every phi has become a move in the predecessor that supplied ' +
      'its value, and the phis are gone. This is the form a code generator can consume, and ' +
      'the copies here are the ones a register allocator will try to coalesce away.';
  }

  function paintMetrics(state) {
    const stats = state.stats;

    root.MetricGrid.update({
      'ss-placed': { value: root.Format.exact(stats.placed),
        note: stats.placed ? 'at the iterated dominance frontier of the blocks that write each slot'
          : 'nothing is written on two paths, so no join needs one' },
      'ss-pruned': { value: root.Format.exact(stats.pruned),
        note: stats.pruned ? stats.phis + ' remain — the rest had no reader at all'
          : 'every placed phi is read by something' },
      'ss-slots': { value: root.Format.exact(stats.slots),
        note: 'each promoted from memory to registers; ' + stats.undefinedReads +
          ' reads found no definition on any path' },
      'ss-checked': { value: state.check.ok ? 'holds' : 'BROKEN',
        note: state.check.ok
          ? state.check.checked + ' definitions, every use dominated by its own'
          : state.check.problems[0].why }
    });
  }

  function paintPhis(state) {
    const byBlock = {};

    state.placement.forEach(function (row) {
      row.frontier.forEach(function (id) {
        byBlock[id + '/' + row.slot] = row;
      });
    });

    root.jQuery('#ss-phis tbody').html(state.phis.map(function (phi) {
      const justification = byBlock[phi.block + '/' + phi.slot];

      return '<tr><td class="mono">' + phi.block + '</td><td class="mono">' +
        root.Helpers.escapeHtml(phi.text) + '</td><td class="mono">' +
        (justification ? justification.source : phi.slot) + '</td><td class="mono">' +
        (justification ? justification.writes.join(', ') : '—') + '</td><td>yes</td></tr>';
    }).join('') || '<tr><td colspan="5">no phi survives in this program — either nothing is ' +
      'written on two paths, or every placed phi was pruned</td></tr>');

    root.Helpers.setText('ss-phis-caption',
      'The fourth column is the justification: the blocks that write the local, whose iterated ' +
      'dominance frontier is where the phi went. That is the whole placement rule, and reading ' +
      'it beside the phi is what makes it a derivation rather than a recipe. A phi at a loop ' +
      'header always has two entries — one from outside, one from the latch — which is the ' +
      'shape that makes a loop variable expressible at all.');
  }

  function paintPruning(prune) {
    const rows = suiteFor(prune);
    const placed = rows.reduce(function (sum, row) { return sum + row.placed; }, 0);
    const pruned = rows.reduce(function (sum, row) { return sum + row.pruned; }, 0);

    root.jQuery('#ss-prune-table tbody').html(rows.filter(function (row) {
      return row.placed > 0;
    }).map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.placed +
        '</td><td class="mono">' + row.pruned + '</td><td class="mono">' + row.phis +
        '</td><td class="mono">' + row.instructions + '</td></tr>';
    }).join('') || '<tr><td colspan="5">no program in the suite needs a phi at this setting' +
      '</td></tr>');

    root.Helpers.setText('ss-prune-table-caption',
      placed + ' phis placed across the suite and ' + pruned + ' pruned, leaving ' +
      (placed - pruned) + '. Programs needing none are not listed. The pruning pass is a ' +
      'fixpoint rather than a sweep because removing one phi can make another unread — and ' +
      'the difference between these two columns is exactly what "pruned SSA" means, measured ' +
      'rather than described.');
  }

  function paintDestruction(prune) {
    const rows = suiteFor(prune).filter(function (row) { return row.phis > 0; })
      .concat([swapCycle()]);

    root.jQuery('#ss-destruct tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.phis +
        '</td><td class="mono">' + row.moves + '</td><td class="mono">' + row.temporaries +
        '</td><td>' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ss-destruct-caption', destructionCaption(rows));
  }

  function destructionCaption(rows) {
    const cycles = rows.filter(function (row) { return row.temporaries > 0; });

    return 'Every conformance program needing a phi, plus one hand-built pair. ' +
      cycles.length + ' of ' + rows.length + ' need a temporary, and it is the hand-built ' +
      'one — which is the honest result and worth stating rather than hiding. No Berugo ' +
      'program produces a phi cycle, because the surface language sequences its assignments: ' +
      'writing a swap requires a third variable, and that variable breaks the cycle before SSA ' +
      'ever sees it. A cycle needs two phis whose operands are each other, which arises from ' +
      'simultaneous assignment, from a language with tuple binding, or from an earlier pass ' +
      'that rotated copies. The sequencer still has to be right, so it is exercised against a ' +
      'case built by hand rather than left as an untested branch.';
  }

  /**
   * Two phis that exchange values, built directly. `a = phi(b)` and
   * `b = phi(a)` become two moves, and in either order both registers end up
   * holding the same thing — so the sequencer has to notice the cycle and
   * break it with a temporary. Berugo cannot produce this shape, which is
   * exactly why it is constructed rather than found.
   */
  function swapCycle() {
    const fn = swapFunction();
    const program = { functions: [fn], main: fn.name, globals: [] };
    const before = root.Berugo.IrInterp.run(program);
    let phis = 0;

    root.Berugo.Ir.eachInstruction(fn, function (inst) {
      if (inst.op === 'phi') phis += 1;
    });
    const out = root.Berugo.Ssa.destruct(fn);
    const after = root.Berugo.IrInterp.run(program);

    return { id: 'hand-built swap', phis: phis, moves: out.moves,
      temporaries: out.temporaries,
      agrees: root.Berugo.IrInterp.compare(before, after).agree };
  }

  /**
   * The loop has to TERMINATE, and its result has to depend on both halves of
   * the exchange. An earlier version branched on a Number and returned only
   * `a`, so it could not be run at all and reported `agrees: true` as a
   * literal — a check that asserts its own conclusion. The counter makes the
   * run finite and `a - b` makes a sequencer that collapses the cycle report
   * 0 where the swap reports 1.
   */
  function swapFunction() {
    const Ir = root.Berugo.Ir;
    const fn = Ir.makeFunction('swap-cycle', []);
    const blocks = ['entry', 'header', 'exit']
      .map(function (label) { return Ir.makeBlock(fn, label); });
    const reg = swapRegisters(fn);

    Ir.emit(blocks[0], 'const', { target: reg.a0, value: 1, origin: 'handmade' });
    Ir.emit(blocks[0], 'const', { target: reg.b0, value: 2, origin: 'handmade' });
    Ir.emit(blocks[0], 'const', { target: reg.i0, value: 0, origin: 'handmade' });
    Ir.terminate(blocks[0], 'jump', { target: blocks[1].id, origin: 'handmade' });
    swapHeader(fn, blocks, reg);
    Ir.emit(blocks[2], 'binary', { target: reg.diff, operator: 'sub', left: reg.a1,
      right: reg.b1, origin: 'handmade' });
    Ir.terminate(blocks[2], 'ret', { value: reg.diff, origin: 'handmade' });
    return fn;
  }

  function swapRegisters(fn) {
    const Ir = root.Berugo.Ir;
    const out = {};

    ['a0', 'b0', 'i0', 'a1', 'b1', 'i1', 'i2', 'one', 'limit', 'diff']
      .forEach(function (name) { out[name] = Ir.freshRegister(fn, 'Number'); });
    out.cond = Ir.freshRegister(fn, 'Bool');
    return out;
  }

  function swapHeader(fn, blocks, reg) {
    const Ir = root.Berugo.Ir;
    const header = blocks[1];
    const phi = function (target, fromEntry, fromLatch) {
      header.instructions.push(Ir.instruction('phi', { target: target,
        incoming: [{ block: blocks[0].id, value: fromEntry },
          { block: header.id, value: fromLatch }], origin: 'handmade' }));
    };

    phi(reg.a1, reg.a0, reg.b1);
    phi(reg.b1, reg.b0, reg.a1);
    phi(reg.i1, reg.i0, reg.i2);
    Ir.emit(header, 'const', { target: reg.one, value: 1, origin: 'handmade' });
    Ir.emit(header, 'const', { target: reg.limit, value: 3, origin: 'handmade' });
    Ir.emit(header, 'binary', { target: reg.i2, operator: 'add', left: reg.i1,
      right: reg.one, origin: 'handmade' });
    Ir.emit(header, 'binary', { target: reg.cond, operator: 'lt', left: reg.i1,
      right: reg.limit, origin: 'handmade' });
    Ir.terminate(header, 'branch', { cond: reg.cond, then: header.id,
      other: blocks[2].id, origin: 'handmade' });
  }

  function paintCheck(prune) {
    const rows = suiteFor(prune);
    const holding = rows.filter(function (row) { return row.single && row.dominated; }).length;
    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    root.jQuery('#ss-check tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.registers +
        '</td><td>' + (row.single ? 'yes' : 'NO') + '</td><td>' +
        (row.dominated ? 'yes' : 'NO') + '</td><td>' + (row.agrees ? 'yes' : 'NO') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ss-check-caption',
      holding + ' of ' + rows.length + ' hold both SSA invariants and ' + agreeing + ' of ' +
      rows.length + ' still compute what the program computed before construction. The ' +
      'dominance check treats a phi\'s operands specially and has to: they are used on the ' +
      'EDGE, so the definition must dominate the PREDECESSOR rather than the phi\'s own ' +
      'block. A checker that forgets that rejects correct SSA, which is worse than one that ' +
      'accepts incorrect SSA — it makes the invariant useless because nobody can turn it on.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

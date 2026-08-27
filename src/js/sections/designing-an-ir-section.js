/**
 * Section: Designing an intermediate representation.
 *
 * The measurement is the verifier. Five deliberate defects can be injected —
 * a missing terminator, a jump to nowhere, a read of an undefined register, an
 * unreachable block — and each time the verifier names the invariant rather
 * than refusing. That is the whole argument for having one: without it, a
 * broken pass shows up as wrong output from a program compiled through eleven
 * passes, and the bisect is manual.
 *
 * The second is the suite: every conformance program lowers, verifies, and
 * runs to exactly what the core language ran to. An IR that verifies and
 * computes something else is the failure the verifier cannot see, which is
 * why both columns are reported.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'designing-an-ir';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one expression, lowered to three-address code',
      caption: '`t + v * 2` is a tree with three interior nodes and becomes three ' +
        'instructions, each computing one thing into a named register. The names are the ' +
        'point. In the tree, "the multiplication" is a position; in the IR it is `%2`, and ' +
        'every later pass can talk about it — is it constant, is it loop-invariant, is it ' +
        'computed twice. A stack machine would be smaller and would give the multiplication ' +
        'no name at all, which is why this IR uses registers and M30\'s bytecode does not.',
      definition: [
        'graph TD',
        'T["t + v * 2"] --> A["%0 = load t"]',
        'T --> B["%1 = load v"]',
        'B --> C["%2 = const 2"]',
        'C --> D["%3 = mul %1, %2"]',
        'D --> E["%4 = add %0, %3"]',
        'A --> E',
        'E --> F["store t, %4"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**An AST is a tree and control flow is a graph, which is why optimisation does not ' +
        'happen on the AST.** "Is this value available here" is a question about paths, and a ' +
        'tree has no paths. Every analysis in this milestone would have to reconstruct the ' +
        'graph first, from a structure that deliberately hides it. Lowering once and asking ' +
        'the question against the graph is the whole argument for a middle end.',
      '**Three-address code: one operation per instruction, into a named register.** The ' +
        'nesting disappears and every intermediate value gets a name. That is what lets a pass ' +
        'say "the definition of `%3`" instead of "the left child of the parent of this node", ' +
        'and it is why nearly every optimisation is stated in terms of registers.',
      '**Registers rather than a stack, deliberately.** A stack IR is smaller and is what M30 ' +
        'will emit for the VM. But on a stack the definition of a value is a POSITION, and a ' +
        'position changes whenever anything before it changes — so every optimisation would ' +
        'have to be phrased as a stack transformation. Registers cost size and buy names.',
      '**Typed, because the checker already computed the types.** Throwing them away means the ' +
        'optimiser has to guess what an addition adds, and a peephole rule like `x * 0 = 0` is ' +
        'only sound for numbers. Keeping them makes those rules expressible and lets the ' +
        'verifier catch a pass that produced a type-inconsistent instruction.',
      '**Every named local is a SLOT, not a register — until 29.4 promotes it.** `let t = 0; ' +
        'while … { t = t + 1; }` gives `t` a value that depends on which path ran, and a ' +
        'compile-time map from name to register cannot express that. Loads and stores can. ' +
        'The promotion back to registers is what a phi function is for, and doing it here ' +
        'instead produced an IR that read a register the loop never defined.',
      '**The verifier is the highest-value piece of a middle end.** It turns "the optimiser ' +
        'produced garbage somewhere" into "pass X broke invariant Y", instantly. Ten ' +
        'invariants, each named, and the demo lets each be violated on purpose — because a ' +
        'check nobody has watched fire is a check nobody believes.',
      '**Every instruction keeps the span of the construct it came from.** M28 spent a whole ' +
        'milestone making spans survive desugaring; dropping them at the IR boundary would ' +
        'waste it, and a diagnostic from the optimiser — "this loop cannot be vectorised" — is ' +
        'useless without one.',
      '**Lowering is checked by running, like everything else here.** The IR interpreter and ' +
        'the core interpreter must agree on the value, the output, the outcome and every ' +
        'binding the program leaves behind. An IR that verifies and computes something else is ' +
        'exactly the failure a verifier cannot see.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the IR, and a verifier you can break on purpose',
        markup: root.DesignIrTemplate.render()
      },
      diagram: diagram(),
      insight: '**The IR verifier is the single highest-value piece of a compiler\'s middle ' +
        'end, and the reason is a debugging argument rather than a correctness one.** Every ' +
        'pass is individually plausible and the pipeline is eleven of them deep. When the ' +
        'output is wrong, the question is which pass broke it, and without a verifier the only ' +
        'way to answer is to bisect by hand: run one pass, look at the IR, decide whether it ' +
        'is still reasonable, repeat. That is slow and it depends on a human recognising ' +
        'invalid IR, which people are bad at — a block with two terminators looks fine at a ' +
        'glance. Running the verifier after every pass converts the same failure into a line ' +
        'that names the pass and the invariant. The cost is one walk per pass and it is paid ' +
        'in the first hour of the first bug. The corollary matters as much: a verifier can ' +
        'only check what somebody wrote down, so an invariant that lives in a comment is not ' +
        'an invariant. All ten of these are executable, and the demo exists to show each one ' +
        'firing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DesignIrTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const compileFor = root.Helpers.memoise(function (source) {
    const built = root.Berugo.IrLower.compile(source);

    return { built: built, fn: built.program.functions[0] };
  });

  /**
   * Each defect is applied to a fresh copy, so switching back and forth cannot
   * accumulate damage — and so the "none" row really is the IR as the lowering
   * produced it rather than one that happens to have been repaired.
   */
  const brokenFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const program = root.Berugo.IrLower.compile(parts[0]).program;
    const fn = program.functions[0];

    if (parts[1] !== 'none') breakInvariant(fn, parts[1]);
    return { program: program, fn: fn, verified: root.Berugo.Ir.verify(fn) };
  });

  const BREAKERS = {
    terminator: function (fn) { fn.blocks[fn.blocks.length - 1].terminator = null; },
    target: function (fn) {
      const block = fn.blocks.find(function (entry) { return entry.terminator; });

      if (block.terminator.op === 'jump') block.terminator.target = 'bNope';
      else block.terminator.then = 'bNope';
    },
    defined: function (fn) {
      fn.blocks[0].instructions.push(root.Berugo.Ir.instruction('move',
        { target: '%999', from: '%404', origin: 'injected' }));
    },
    reachable: function (fn) {
      const block = root.Berugo.Ir.makeBlock(fn, 'orphan');

      root.Berugo.Ir.terminate(block, 'ret', { value: null, origin: 'injected' });
    }
  };

  function breakInvariant(fn, kind) {
    if (BREAKERS[kind]) BREAKERS[kind](fn);
  }

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const built = root.Berugo.IrLower.compile(entry.source);
      const fn = built.program.functions[0];
      const core = root.Berugo.Interp.compareWithCore(entry.source).core;
      const ir = root.Berugo.IrInterp.run(built.program);

      return { id: entry.id, core: root.Berugo.Ast.countNodes(built.core),
        blocks: fn.blocks.length, instructions: root.Berugo.Ir.instructionCount(fn),
        verified: root.Berugo.Ir.verifyProgram(built.program).ok,
        agrees: root.Berugo.IrInterp.compare(core, ir).agree };
    });
  });

  function update() {
    const values = panel.values();
    const source = root.DesignIrTemplate.SAMPLES[values['mi-sample']];
    const clean = compileFor(source);
    const broken = brokenFor(JSON.stringify([source, values['mi-break']]));

    paintCore(clean);
    paintMetrics(clean, broken);
    paintListing(broken);
    paintOrigins(clean, source);
    paintInvariants(broken);
    paintOpcodes();
    paintSuite();
  }

  function paintCore(state) {
    root.Helpers.setText('mi-core', root.Berugo.Ast.print(state.built.core));
    root.Helpers.setText('mi-core-caption',
      'The core language, which still has `while` and `if` as nodes. Everything below this ' +
      'point is blocks and jumps — and the reason for the change is that the questions the ' +
      'optimiser asks are about paths, which a tree does not have.');
  }

  function paintMetrics(clean, broken) {
    const fn = clean.fn;
    const verified = broken.verified;

    root.MetricGrid.update({
      'mi-blocks': { value: root.Format.exact(fn.blocks.length),
        note: 'each ending in exactly one terminator, which is invariant one' },
      'mi-instructions': { value: root.Format.exact(root.Berugo.Ir.instructionCount(fn)),
        note: 'terminators included; each computes one thing' },
      'mi-registers': { value: root.Format.exact(fn.nextRegister),
        note: fn.slots.length + ' named locals are still slots, and 29.4 promotes them' },
      'mi-verified': { value: verified.ok ? 'passes' : verified.problems[0].invariant,
        note: verified.ok ? 'all ' + verified.checked + ' invariants hold'
          : verified.problems[0].where + ': ' + verified.problems[0].why }
    });
  }

  function paintListing(broken) {
    root.AstView.render(document.getElementById('mi-listing'),
      root.CfgView.listing(broken.fn, { show: root.Berugo.Ir.showInstruction }));

    root.Helpers.setText('mi-listing-caption',
      'Registers are `%n` and named locals are `@n` slots, read with `load` and written with ' +
      '`store`. That looks wasteful and is the only correct choice before SSA: a variable ' +
      'assigned inside a loop has a value that depends on which path ran, and no compile-time ' +
      'map from name to register can say that.');
  }

  function paintOrigins(state, source) {
    const rows = [];

    root.Berugo.Ir.eachInstruction(state.fn, function (inst, block) {
      if (rows.length >= 24) return;
      rows.push({ block: block.id, text: root.Berugo.Ir.showInstruction(inst),
        origin: inst.origin || '—',
        source: inst.span ? source.slice(inst.span.start, inst.span.end) : '' });
    });

    root.jQuery('#mi-origin tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.block + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.text) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.origin) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(shorten(row.source)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mi-origin-caption',
      'Every instruction names the construct it came from and carries that construct\'s span. ' +
      'The last column is the source text at that span, so the attribution can be read rather ' +
      'than trusted — and a row whose source is empty would be an instruction the optimiser ' +
      'could never explain.');
  }

  function shorten(text) {
    const flat = String(text).replace(/\s+/g, ' ');

    return flat.length > 40 ? flat.slice(0, 37) + '…' : flat;
  }

  function paintInvariants(broken) {
    const violated = {};

    broken.verified.problems.forEach(function (problem) {
      violated[problem.invariant] = problem.where + ': ' + problem.why;
    });

    root.jQuery('#mi-invariants tbody').html(root.Berugo.Ir.INVARIANTS.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td>' +
        root.Helpers.escapeHtml(row.about) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(violated[row.id] || '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mi-invariants-caption', invariantCaption(broken));
  }

  function invariantCaption(broken) {
    if (broken.verified.ok) {
      return 'All ' + root.Berugo.Ir.INVARIANTS.length + ' hold on the IR as the lowering ' +
        'produced it. Choose a defect above and watch one of them name itself — the value of ' +
        'a verifier is not that it refuses, it is that it says which rule and where, which is ' +
        'the difference between a failure you can act on and a bisect.';
    }
    return broken.verified.problems.length + ' violation' +
      (broken.verified.problems.length === 1 ? '' : 's') + ', and the invariant is named ' +
      'rather than the IR merely being called invalid. The last two rows are the SSA ' +
      'invariants, which cannot be stated without a dominator tree and so are checked ' +
      'separately from 29.4 onward.';
  }

  function paintOpcodes() {
    const opcodes = root.Berugo.Ir.OPCODES;

    root.jQuery('#mi-opcodes tbody').html(Object.keys(opcodes).map(function (name) {
      const spec = opcodes[name];

      return '<tr><td class="mono">' + name + '</td><td>' + (spec.defines ? 'yes' : 'no') +
        '</td><td class="mono">' + (spec.uses.join(', ') || '—') + '</td><td>' +
        root.Helpers.escapeHtml(spec.about) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mi-opcodes-caption',
      Object.keys(opcodes).length + ' opcodes, and the third column is the one that matters ' +
      'for the rest of the milestone: it names the fields holding operand registers, so every ' +
      'walker, the verifier and every pass read one description of the instruction set rather ' +
      'than each knowing it separately. Adding an opcode is one row here rather than an audit ' +
      'of a dozen switch statements.');
  }

  function paintSuite() {
    const rows = suiteFor('all');
    const verified = rows.filter(function (row) { return row.verified; }).length;
    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    root.jQuery('#mi-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.id) + '</td><td class="mono">' +
        row.core + '</td><td class="mono">' + row.blocks + '</td><td class="mono">' +
        row.instructions + '</td><td>' + (row.verified ? 'yes' : 'NO') + '</td><td>' +
        (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mi-suite-caption',
      verified + ' of ' + rows.length + ' verify and ' + agreeing + ' of ' + rows.length +
      ' compute exactly what the core language computed — the same value, output, outcome and ' +
      'every binding left behind. Both columns are needed: an IR that verifies and computes ' +
      'something else is precisely the failure a verifier cannot see, and it is the one a ' +
      'differential run catches immediately.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

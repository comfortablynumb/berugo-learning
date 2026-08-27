/**
 * Section: Building the interpreter.
 *
 * The measurement is a machine stopped between two instructions. The VM is a
 * step function over an explicit frame stack rather than a recursive
 * interpreter, so the stack, the locals, the upvalues and the call chain are
 * all objects a learner can look at — and the same property is what 30.7's
 * on-stack replacement and 30.9's stack maps are built on.
 *
 * The second is the capture switch. Berugo captures by value, so it has no
 * loop-capture surprise; running the same program with upvalues captured by
 * reference changes the answer, and that one switch is the whole of the
 * question every language answers differently.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'building-the-interpreter';
  let panel = null;

  const CAPTURE = [
    { strategy: 'By value', holds: 'a copy taken when the closure is made',
      closed: 'immediately — there is nothing to close',
      means: 'each closure sees the value at the moment it was created',
      languages: 'Berugo, and Java\'s effectively-final locals' },
    { strategy: 'By reference', holds: 'a cell pointing at the defining frame\'s slot',
      closed: 'when the defining frame returns, by copying the value into the cell',
      means: 'every closure made in the loop sees the LAST value',
      languages: 'Lua, JavaScript\'s `var`, Python\'s default' },
    { strategy: 'By reference, per iteration',
      holds: 'a cell for a slot the loop re-declares each time round',
      closed: 'at the end of each iteration',
      means: 'each closure sees its own iteration\'s value',
      languages: 'JavaScript\'s `let`, C#\'s `foreach` since 5.0' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a frame, and the upvalue chain of a closure',
      caption: 'A frame owns four things and they are four different lifetimes. Parameters and '
        + 'registers die with the frame. Named locals die with the frame too, unless a closure '
        + 'captured one. The operand stack is scratch and is empty between statements. And the '
        + 'upvalue is the interesting one: while the defining frame is alive it points AT the '
        + 'slot, and when that frame returns the value is copied into the cell and the pointer '
        + 'is dropped. That copy is what "closing an upvalue" means, and whether the pointer '
        + 'existed at all is the difference between the two answers to the loop-capture '
        + 'question.',
      definition: [
        'graph TD',
        'F["frame: adder(n)"] --> P["parameters — n"]',
        'F --> L["named locals — slots"]',
        'F --> S["operand stack — scratch"]',
        'C["closure fn(x) => x + n"] --> U["upvalue 0"]',
        'U -->|"open: points at the slot"| L',
        'U -->|"closed: holds a copy"| V["value, after adder returns"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The dispatch loop is the interpreter, and everything else is a table.** Fetch the '
        + 'instruction at the program counter, advance it, look the opcode up, run the rule. '
        + 'JavaScript can express switch dispatch and, through an array of closures, something '
        + 'close to direct threading — but not computed goto, which is what a C interpreter '
        + 'uses to give each opcode its own copy of the branch so the predictor can learn them '
        + 'apart.',
      '**Writing the machine as a step function rather than a recursive interpreter is the '
        + 'decision that pays for three later sections.** A debugger has to stop between '
        + 'instructions, on-stack replacement has to lift a running frame out and put it back, '
        + 'and a stack map has to walk the frames that exist right now. A recursive interpreter '
        + 'keeps all of that on the host language\'s stack, where none of it can be reached.',
      '**A frame is allocated by the callee, because the caller does not know its size.** How '
        + 'many registers and slots a function needs is a property of the function, and it '
        + 'changes when the function is recompiled. So the call sequence is: evaluate the '
        + 'callee, evaluate the arguments, push a frame, and record where the result should '
        + 'land when the frame returns.',
      '**A closure is a function plus its captured values, and the captures are ordinary '
        + 'leading parameters.** The lowering already arranged that in M29, so one call path '
        + 'serves both a plain function and a closure: `captures.concat(arguments)`. Getting '
        + 'that order wrong reads a parameter as a capture, which is a wrong answer rather than '
        + 'a crash.',
      '**Whether the upvalue points at the slot or at a copy is the whole of the loop-capture '
        + 'question.** Point at the slot and every closure made in a loop shares one variable, '
        + 'so they all see the last value; take a copy and each sees its own. JavaScript '
        + 'answered it one way for `var` and the other for `let`, and the answer is decided '
        + 'here, in three lines of the VM.',
      '**An open upvalue has to be closed when its frame returns.** While the frame is alive '
        + 'the cell points at a live slot; once it returns, that slot is gone, so the value is '
        + 'copied into the cell and the pointer dropped. Lua calls this closing, and a runtime '
        + 'that forgets it reads a dead frame — which on a machine with a real stack is a '
        + 'use-after-free.',
      '**A fault has to unwind, and where it unwinds from is the stack trace.** The frames '
        + 'exist at the moment of the fault and are gone a moment later, so a runtime that '
        + 'wants a usable error message has to capture them before the unwinding starts. 30.9 '
        + 'turns the same walk into a garbage collector\'s root set.',
      '**A debugger is the loop with a stopping condition, not a second implementation.** '
        + 'Breakpoints are a set of program counters, a step is one turn of the loop, and '
        + '"inspect" is reading the frame that is already there. That is why a step-debugger is '
        + 'cheap for a bytecode VM and expensive for a compiler — the compiler has to '
        + 'reconstruct what the interpreter simply has.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the machine, stopped between instructions',
        markup: root.VmTemplate.render() },
      diagram: diagram(),
      insight: '**The loop-variable capture question that every language answers differently is '
        + 'decided in three lines of the VM: whether the upvalue points at the slot or at a '
        + 'copy.** It looks like a language-design debate and it is an implementation detail '
        + 'that leaked. Point at the slot and it is cheap, mutation through a closure works, '
        + 'and every closure made in one loop shares one variable — which is why the classic '
        + '"all my callbacks print the last value" bug exists in half the languages you have '
        + 'used. Take a copy and that bug is impossible, mutation through a closure becomes '
        + 'impossible too, and you need another mechanism for a counter. JavaScript shipped '
        + 'both: `var` points at the slot, `let` re-declares the slot each iteration so the '
        + 'pointer is to a fresh one. Neither is wrong; they are different trades between cost, '
        + 'mutability and least surprise. What is worth taking away is that a question people '
        + 'argue about at the level of syntax was settled at the level of a frame layout, and '
        + 'the only way to see that is to build the frame.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.VmTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const compiledFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const program = root.Berugo.IrLower.compile(root.VmTemplate.SAMPLES[parts[0]]).program;

    return { program: program,
      compiled: root.Berugo.Bytecode.compile(program, { mode: parts[1] }),
      reference: root.Berugo.IrInterp.run(program) };
  });

  /**
   * A session stepped forward N instructions from the start, rather than one
   * kept between updates. Re-running is cheap on programs this size and it
   * means the slider is a position rather than a history — dragging it
   * backwards has to show what was there, and a live session cannot go back.
   */
  const stoppedAt = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const state = compiledFor(JSON.stringify([parts[0], parts[1]]));
    const session = root.Berugo.Vm.session(state.compiled,
      { budget: 400000, byReference: parts[3] });

    for (let at = 0; at < parts[2] && !session.done(); at += 1) session.step();
    return { session: session, snapshot: session.snapshot(), where: session.where() };
  });

  const finishedFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const state = compiledFor(JSON.stringify([parts[0], parts[1]]));
    const out = root.Berugo.Vm.run(state.compiled, { budget: 400000, byReference: parts[2] });

    return { out: out, agrees: root.Berugo.IrInterp.compare(state.reference, out).agree };
  });

  const suiteFor = root.Helpers.memoise(function (mode) {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const program = root.Berugo.IrLower.compile(entry.source).program;
      const compiled = root.Berugo.Bytecode.compile(program, { mode: mode });
      const out = root.Berugo.Vm.run(compiled, { budget: 400000 });

      return { id: entry.id, dispatches: out.dispatches, natives: out.natives,
        depth: deepestFrame(compiled),
        agrees: root.Berugo.IrInterp.compare(root.Berugo.IrInterp.run(program), out).agree };
    });
  });

  function deepestFrame(compiled) {
    return Object.keys(compiled.chunks).length;
  }

  function update() {
    const values = panel.values();
    const base = JSON.stringify([values['bi-sample'], values['bi-mode']]);
    const stop = JSON.stringify([values['bi-sample'], values['bi-mode'],
      Number(values['bi-step']), Boolean(values['bi-capture'])]);
    const state = stoppedAt(stop);

    paintFrame(state);
    paintMetrics(state, JSON.stringify([values['bi-sample'], values['bi-mode'],
      Boolean(values['bi-capture'])]));
    paintListing(base, state);
    paintStack(state);
    paintCapture();
    paintSuite(values['bi-mode']);
  }

  function paintFrame(state) {
    root.AstView.render(document.getElementById('bi-frame'),
      root.BytecodeView.frame(state.snapshot));

    root.Helpers.setText('bi-frame-caption',
      'The operand stack, the named locals and the upvalues of the innermost frame. Between '
      + 'two statements the operand stack is empty; inside an expression it holds the pieces '
      + 'the next instruction will consume, which is exactly what "the operands are implicit" '
      + 'means on a stack machine.');
  }

  function paintMetrics(state, finishedKey) {
    const finished = finishedFor(finishedKey);

    root.MetricGrid.update({
      'bi-at': { value: state.snapshot.fn ? state.snapshot.fn + ':' + state.snapshot.at : '—',
        note: state.snapshot.op ? 'about to run ' + state.snapshot.op : 'finished' },
      'bi-depth': { value: state.where.length,
        note: state.where.length ? 'innermost is ' + state.where[0].fn : 'nothing running' },
      'bi-dispatched': { value: state.snapshot.dispatches,
        note: 'instructions executed to reach this point' },
      'bi-outcome': { value: finished.out.outcome,
        note: finished.agrees ? 'the same value, output and bindings as the IR interpreter'
          : 'DISAGREES with the IR interpreter' }
    });
  }

  function paintListing(base, state) {
    const built = compiledFor(base);
    const chunk = built.compiled.chunks[state.snapshot.fn || built.compiled.main];

    root.AstView.render(document.getElementById('bi-listing'),
      root.BytecodeView.listing(root.Berugo.Bytecode.disassemble(chunk),
        { highlight: state.snapshot.at }));

    root.Helpers.setText('bi-listing-caption',
      'The code of the innermost frame, with the program counter marked. A debugger is this '
      + 'loop with a stopping condition rather than a second implementation of anything — '
      + 'which is why a bytecode VM gets one almost for free and an optimising compiler has to '
      + 'reconstruct it.');
  }

  function paintStack(state) {
    root.jQuery('#bi-stack tbody').html(state.where.map(function (row, at) {
      return '<tr><td class="mono">' + at + '</td><td class="mono">' + row.fn +
        '</td><td class="mono">' + row.at + '</td><td class="mono">' + row.op +
        '</td><td class="mono">' + row.locals + '</td></tr>';
    }).join('') || '<tr><td colspan="5">the program has finished; no frame is live</td></tr>');

    root.Helpers.setText('bi-stack-caption',
      state.where.length + ' frames are live at this instruction. These objects exist right '
      + 'now and are gone a moment after a fault unwinds them, which is why a runtime that '
      + 'wants a usable stack trace has to capture them before the unwinding rather than '
      + 'after — and why the same walk is what 30.9 hands a garbage collector.');
  }

  function paintCapture() {
    root.jQuery('#bi-capture-table tbody').html(CAPTURE.map(function (row) {
      return '<tr><td class="mono">' + row.strategy + '</td><td>' + row.holds + '</td><td>' +
        row.closed + '</td><td>' + row.means + '</td><td>' + row.languages + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bi-capture-caption',
      'Three answers to one question, and every language you have used picked one of them. '
      + 'Berugo captures by value, so the classic "all my callbacks printed the last value" '
      + 'bug cannot happen in it — and neither can a counter closure, which is the price. '
      + 'Turning the switch on above runs the same program the other way.');
  }

  function paintSuite(mode) {
    const rows = suiteFor(mode);

    root.jQuery('#bi-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.dispatches +
        '</td><td class="mono">' + row.depth + '</td><td class="mono">' + row.natives +
        '</td><td>' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    root.Helpers.setText('bi-suite-caption',
      agreeing + ' of ' + rows.length + ' programs run to exactly what the IR interpreter ran '
      + 'to — same value, same output, same outcome, same bindings. The native column is the '
      + 'honest footnote: a builtin like `len` or `print` is called through the reference '
      + 'runtime rather than reimplemented here, so those calls are correct by construction '
      + 'and are not dispatches this machine paid for.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

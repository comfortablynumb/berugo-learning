/**
 * Section: Assembly programming.
 *
 * Four real programs, assembled and single-stepped. The recursion example is
 * the one that earns its place: it saves the return address, saves its
 * argument, recurses, restores both and returns the stack pointer to where it
 * found it — and the stack table shows the frames stacking up, which is the
 * only way the convention stops being a list of rules.
 *
 * Every figure in the prose is recomputed by the figure suite from the same
 * source in `machines/brv32/programs.js`, so a program that changes takes its
 * numbers with it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'assembly-programming';
  const Assembler = root.Brv32.Assembler;
  const Reference = root.Brv32.Reference;
  const Programs = root.Brv32.Programs;
  const Isa = root.Brv32.Isa;
  const RegisterView = root.RegisterView;
  const STACK_TOP = 0x10000f00;
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one stack frame, and why each field is there',
      caption: 'A frame exists because a function has state that must survive a call. The '
        + 'return address is in a register when the function starts, and the moment it calls '
        + 'anything that register is overwritten — so it goes on the stack. The same applies to '
        + 'any argument or local the function still needs afterwards. The stack pointer moves '
        + 'down once at entry and back up once at exit, and everything in between is addressed '
        + 'relative to it. That discipline is what makes recursion work: each invocation gets '
        + 'its own copy of everything it saved, and the demo shows five of them stacked up '
        + 'during the factorial.',
      definition: [
        'flowchart TD',
        'HIGH["higher addresses"] --> CALLER["caller frame"]',
        'CALLER --> RA["saved return address<br/>4(sp)"]',
        'RA --> ARG["saved argument<br/>0(sp)"]',
        'ARG --> SP["stack pointer"]',
        'SP --> LOW["lower addresses — the stack grows down"]',
        'CALLER -.->|"addi sp, sp, -8 at entry"| SP',
        'SP -.->|"addi sp, sp, 8 at exit"| CALLER'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Assembly is a data-movement language with arithmetic attached.** Almost every line '
        + 'either moves a value between a register and memory or combines two registers. The '
        + 'skill is not knowing the instructions, of which there are forty. It is keeping track '
        + 'of where each value currently lives, which is exactly the bookkeeping a register '
        + 'allocator does for you in a compiler.',
      '**A loop is a compare and a branch, and the compiler writes it backwards.** The natural '
        + 'form tests at the top and jumps to the bottom on failure. The efficient form falls '
        + 'through into the body and branches backwards at the end, which costs one branch per '
        + 'iteration instead of two. Recognising the second shape is most of reading compiler '
        + 'output.',
      '**The calling convention is an agreement, not a mechanism.** Nothing in the hardware '
        + 'stops a function from clobbering a saved register. The convention says which '
        + 'registers a caller may rely on across a call and which it must save itself. Every '
        + 'compiled language on a platform agrees to the same one, which is why they can call '
        + 'each other at all.',
      '**The return address lives in a register, and that is why leaf functions are cheap.** A '
        + 'function that calls nothing else can leave the return address in `ra` and never '
        + 'touch the stack. The moment it calls something, `ra` is overwritten — so it must '
        + 'save it, which is the whole reason a frame exists.',
      '**A frame is a stack-pointer adjustment and some stores.** Subtract at entry, store what '
        + 'must survive, use the space, load it back, add at exit. Get the addition wrong and '
        + 'the caller returns to nonsense. It is one of the few bugs in this course that '
        + 'produces no error message at all, just a jump to an address nobody chose.',
      '**Recursion needs nothing special from the hardware.** Each invocation subtracts its own '
        + 'frame, so each has its own saved argument and return address. The demo\'s factorial '
        + 'reaches five frames deep and unwinds them exactly, and the stack table is the proof '
        + '— that is all "the call stack" ever was.',
      '**There is no multiply in the base instruction set, and that is instructive.** The '
        + 'factorial program multiplies by repeated addition, which is why it takes 125 '
        + 'instructions to compute a number you can work out in your head. Extensions exist '
        + 'precisely because this is unacceptable, and the base set stays small so that a '
        + 'minimal implementation is genuinely minimal.',
      '**Reading the compiler\'s assembly is the most durable skill in this track.** It is how '
        + 'you settle "did that get optimised" without guessing, and how you find the bounds '
        + 'check that did not get removed. It is how you discover that your carefully written '
        + 'branchless code compiled to a branch. Everything above assembly is a claim; this is '
        + 'the '
        + 'evidence.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — assemble, then step',
        markup: root.AssemblyTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The calling convention is the most important thing in this section, and it is not '
      + 'enforced by anything.** No gate checks that a callee preserved `s0`; no instruction '
      + 'faults when a function returns with the stack pointer in the wrong place. It is a '
      + 'document that every compiler, every assembler-writing human and every library on a '
      + 'platform agrees to follow. The entire ecosystem of separately compiled code rests '
      + 'on that agreement. That is worth sitting with, because it is the same shape as every '
      + 'important interface you will work with. A protocol nobody validates, held together by '
      + 'everybody implementing it correctly, where a single participant who breaks the rules '
      + 'produces failures far from the mistake. A function that clobbers a saved register does '
      + 'not crash: its caller does, later, doing something unrelated. The practical skill '
      + 'that follows is being able to read the assembly a compiler produced and check the '
      + 'convention by eye. Is the return address saved before the first call, is the stack '
      + 'pointer restored on every path out, does the epilogue match the prologue? That is also '
      + 'exactly what a stack-unwinding debugger, a profiler and an exception handler do. It is '
      + 'why they all break in the same way when a hand-written routine gets it wrong.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.AssemblyTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  const assembled = root.Helpers.memoise(function (name) {
    return Assembler.assemble(Programs.CATALOGUE[name].source, { origin: 0 });
  });

  /** Run from the start every time. A stepper that keeps a machine around is a
   *  stepper whose state depends on which control you touched last. */
  const runTo = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const image = assembled(parts.name);
    const machine = Reference.create({ image: image.bytes, entry: 0, stack: STACK_TOP });
    const history = [Reference.snapshot(machine)];
    let trapped = null;

    for (let at = 0; at < parts.steps; at += 1) {
      const out = Reference.step(machine);

      history.push(Reference.snapshot(machine));
      if (out.trapped) { trapped = out.cause; break; }
    }
    return { machine: machine, history: history, trapped: trapped,
      state: Reference.snapshot(machine) };
  });

  const finalRun = root.Helpers.memoise(function (name) {
    const image = assembled(name);
    const machine = Reference.create({ image: image.bytes, entry: 0, stack: STACK_TOP });
    const run = Reference.run(machine, { budget: 3000, stopOnTrap: true });

    return { run: run, state: Reference.snapshot(machine), machine: machine };
  });

  function reading() {
    const values = panel.values();
    const name = values['asm-program'];

    return { name: name, steps: Number(values['asm-step']), all: Boolean(values['asm-all']),
      image: assembled(name), spec: Programs.CATALOGUE[name],
      run: runTo(JSON.stringify({ name: name, steps: Number(values['asm-step']) })),
      whole: finalRun(name) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintRegisters(view);
    paintListing(view);
    paintStack(view);
    paintConvention();
    paintIdioms();
    paintChart(app, view);
  }

  function currentLine(view) {
    const at = view.run.state.pc;

    return view.image.listing.filter(function (row) { return row.address === at; })[0];
  }

  function paintMetrics(view) {
    const line = currentLine(view);
    const depth = Math.max(0, STACK_TOP - (view.run.state.registers[2] | 0));
    const result = view.spec.result === undefined ? null
      : view.run.state.registers[view.spec.result];

    root.MetricGrid.update({
      'asm-pc': { value: '0x' + view.run.state.pc.toString(16),
        note: line ? line.text.trim() : 'past the end of the program' },
      'asm-retired': { value: view.run.history.length - 1,
        note: 'the whole run takes ' + view.whole.run.steps },
      'asm-result': { value: result === null ? '—' : result,
        note: view.spec.result === null ? 'this program writes to a device'
          : 'in x' + view.spec.result },
      'asm-stack': { value: depth + ' bytes',
        note: depth ? 'sp is 0x' + (view.run.state.registers[2] >>> 0).toString(16)
          : 'nothing pushed yet' },
      'asm-calls': { value: Math.floor(depth / 8),
        note: 'each frame here is 8 bytes: a return address and an argument' },
      'asm-final': { value: view.spec.result === undefined ? view.whole.machine.memory.console
        : view.whole.state.registers[view.spec.result],
      note: view.whole.run.reason }
    });
  }

  const ROLES = { 0: 'always zero', 1: 'return address', 2: 'stack pointer',
    5: 'temporary', 6: 'temporary', 7: 'temporary', 8: 'saved', 9: 'saved',
    10: 'argument and return value', 11: 'argument', 12: 'argument', 13: 'argument' };

  function paintRegisters(view) {
    const previous = view.run.history.length > 1
      ? view.run.history[view.run.history.length - 2].registers : [];
    const rows = RegisterView.rows(view.run.state.registers,
      { previous: previous, all: view.all });

    fill('asm-registers', rows.map(function (row) {
      return [row.name + ' (x' + row.index + ')', ROLES[row.index] || 'temporary',
        row.hex, row.signed, row.changed ? 'yes — this instruction' : ''];
    }));
    root.Helpers.setText('asm-registers-caption', registersCaption(view, rows));
  }

  function registersCaption(view, rows) {
    const changed = rows.filter(function (row) { return row.changed; });

    return 'The registers that are live, plus the ones every program uses. ' +
      (changed.length ? 'The last instruction changed ' + changed.map(function (row) {
        return row.name;
      }).join(' and ') + '.' : 'The last instruction changed no register — it was a branch, a '
        + 'store or a jump.') + ' Tick the box above to see all thirty-two, most of which are '
      + 'zero and stay that way.';
  }

  function paintListing(view) {
    const at = view.run.state.pc;

    fill('asm-listing', view.image.listing.slice(0, 40).map(function (row) {
      return [row.address === at ? '→' : '',
        '0x' + row.address.toString(16).padStart(4, '0'),
        row.word === undefined ? '(data)' : '0x' + (row.word >>> 0).toString(16).padStart(8, '0'),
        row.text.trim(), row.from ? 'expanded from ' + row.from : ''];
    }));
    root.Helpers.setText('asm-listing-caption', listingCaption(view));
  }

  function listingCaption(view) {
    const expanded = view.image.listing.filter(function (row) { return row.from; });

    return 'The assembled program, with the arrow at the current instruction. ' +
      expanded.length + ' of these lines were written by the assembler rather than by the '
      + 'programmer: pseudo-instructions expand to one or two real instructions, and reading '
      + 'disassembly means knowing which is which.';
  }

  function paintStack(view) {
    const pointer = view.run.state.registers[2] | 0;
    const rows = [];

    for (let address = pointer; address < STACK_TOP && rows.length < 12; address += 4) {
      rows.push(['0x' + (address >>> 0).toString(16),
        String(readWord(view.run.machine, address)),
        (address - pointer) % 8 === 4 ? 'saved return address' : 'saved argument']);
    }
    fill('asm-stack-table', rows.length ? rows
      : [['—', '—', 'nothing on the stack: no call has pushed a frame yet']]);
    root.Helpers.setText('asm-stack-table-caption', stackCaption(view, rows));
  }

  function readWord(machine, address) {
    const out = root.Brv32.Devices.read(machine.memory, address, 4, true);

    return out.fault ? 0 : out.value;
  }

  function stackCaption(view, rows) {
    if (!rows.length) {
      return 'The stack is empty at this point. Step further into the factorial program and '
        + 'the frames appear one per recursive call.';
    }
    return rows.length + ' words are on the stack, which is ' + Math.floor(rows.length / 2) +
      ' frame(s) of a call that has not returned yet. Each frame is exactly what this function '
      + 'needed to survive its own recursive call: the return address, which the call '
      + 'overwrites, and the argument, which it also overwrites.';
  }

  function paintConvention() {
    fill('asm-convention', [
      ['x0', 'zero', 'always reads zero, discards writes', 'nobody — it has no state'],
      ['x1', 'ra', 'return address, written by jal', 'the caller, if it calls again'],
      ['x2', 'sp', 'stack pointer, always aligned', 'the callee — restore it exactly'],
      ['x5-x7, x28-x31', 't0-t6', 'temporaries', 'the caller, if it needs them after a call'],
      ['x8-x9, x18-x27', 's0-s11', 'saved registers', 'the callee, before using them'],
      ['x10-x17', 'a0-a7', 'arguments; a0 and a1 also carry return values',
        'the caller — a call may destroy them']
    ]);
    root.Helpers.setText('asm-convention-caption', 'Six rows, none of which the hardware '
      + 'enforces. A callee that fails to restore a saved register produces a failure in its '
      + 'caller, doing something unrelated, some time later — which is why the convention is '
      + 'checked by convention rather than by debugging.');
  }

  function paintIdioms() {
    fill('asm-idioms', [
      ['addi rd, x0, n', 'load a small constant', 'there is no separate load-immediate; x0 '
        + 'makes one out of an add'],
      ['addi rd, rs, 0', 'a register move', 'and it is why `mv` is a pseudo-instruction'],
      ['jalr x0, ra, 0', 'a return', 'jump to the return address and discard the new one'],
      ['beq rs, x0, target', 'branch if zero', 'x0 again — no compare-with-constant is needed'],
      ['slli rd, rs, 2', 'multiply by four', 'array indexing: a word is four bytes'],
      ['lui then addi', 'a 32-bit constant in two instructions',
        'twelve bits is all an I-format immediate has']
    ]);
    root.Helpers.setText('asm-idioms-caption', 'Six patterns that appear constantly in '
      + 'compiler output. Most of them exist because x0 turns a general instruction into a '
      + 'special one for free, which is the cheapest design decision in the whole instruction '
      + 'set.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#asm-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'instructions executed',
      values: Object.keys(Programs.CATALOGUE).filter(function (name) {
        return Programs.CATALOGUE[name].result !== undefined;
      }).map(function (name, index) {
        return { label: name, value: finalRun(name).run.steps, series: index };
      })
    });
    root.Helpers.setText('asm-chart-note', chartNote(view));
  }

  function chartNote() {
    const sum = finalRun('sum').run.steps;
    const factorial = finalRun('factorial').run.steps;

    return 'Instructions executed by each program, run to completion. The factorial is the '
      + 'outlier at ' + factorial + ' against ' + sum + ' for the sum loop, and almost all of '
      + 'the difference is that the base instruction set has no multiply: every multiplication '
      + 'in it is a loop of additions. That is what an instruction-set extension is for, and '
      + 'why "how many instructions does this take" is a property of the ISA rather than of '
      + 'the algorithm.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

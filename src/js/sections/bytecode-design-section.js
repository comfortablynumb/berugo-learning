/**
 * Section: Bytecode design.
 *
 * The measurement is two code generators over one IR. Instructions, encoded
 * bytes and executed dispatches are reported for both sets on the same
 * program, and the differential against the IR interpreter is a column so a
 * smaller number can never be a wrong one.
 *
 * The second is the peephole toggle. A stack generator that stores every
 * value into a temporary and loads it straight back makes the stack set look
 * twice the size of the register set; leaving the value on the stack is what
 * a real generator does, and the gap between the two rows is how much of the
 * famous stack/register difference is the instruction set and how much is one
 * missing rewrite.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bytecode-design';
  let panel = null;
  let chart = null;
  let application = null;

  const DESIGNS = [
    { runtime: 'JVM', shape: 'stack', encoding: 'variable width, one-byte opcode',
      bought: 'a verifier that can typecheck the bytecode, because the stack shape is static' },
    { runtime: 'CPython', shape: 'stack', encoding: 'fixed 16-bit pairs since 3.6',
      bought: 'a trivially indexable instruction stream, and room for adaptive specialisation' },
    { runtime: 'Lua 5.0', shape: 'register', encoding: 'fixed 32-bit words',
      bought: 'roughly half the instructions and a measurably faster interpreter loop' },
    { runtime: 'V8 Ignition', shape: 'register', encoding: 'variable width with prefixes',
      bought: 'a compact stream the optimising tier can consume directly as its input' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one expression, two instruction sets',
      caption: '`t + v * 2` on a stack machine is five instructions whose operands are wherever '
        + 'the stack happens to be; on a register machine it is two, each naming what it reads '
        + 'and where it writes. The stack version is smaller per instruction and there are more '
        + 'of them, and the register version is the other way round. Which wins depends '
        + 'entirely on what a dispatch costs, which is why this is a measurement rather than an '
        + 'opinion — and why the same argument reappears as CISC against RISC in M34, one level '
        + 'down.',
      definition: [
        'graph TD',
        'S["stack: LOAD t · LOAD v · CONST 2 · MUL · ADD"]',
        'R["register: MUL r2, v, 2 · ADD r3, t, r2"]',
        'S --> D1["5 dispatches, 1-2 bytes each"]',
        'R --> D2["2 dispatches, 4-5 bytes each"]',
        'D1 --> Q["which is faster depends on the cost of a dispatch"]',
        'D2 --> Q'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A bytecode is an instruction set you get to design, and the first choice is where the '
        + 'operands live.** On a stack machine they are implicit — an instruction pops what it '
        + 'needs — so an instruction is one opcode and often no operands at all. On a register '
        + 'machine each instruction names its inputs and its output, so it is bigger and there '
        + 'are fewer of them. Everything else in this section follows from that one decision.',
      '**The number that decides it is the cost of a dispatch, not the count of instructions.** '
        + 'A dispatch is the switch, the operand decode and the branch back to the top of the '
        + 'loop, and on a modern processor it is an indirect branch the predictor often gets '
        + 'wrong. Halving the dispatches is worth more than halving the bytes, which is why Lua '
        + '5.0 moved to registers and reported a large speed-up for a larger bytecode.',
      '**The IR this compiles from is already three-address, so the register generator is '
        + 'nearly a transcription and the stack generator is the interesting one.** Flattening '
        + 'a three-address form onto a stack means every value that a later instruction reads '
        + 'has to be kept somewhere, and "somewhere" is a scratch slot — which is exactly what '
        + 'a real stack VM spends its local array on.',
      '**Before SSA, every non-parameter register lives and dies inside one block.** Anything '
        + 'that crosses a block boundary went through a named local, so a virtual register can '
        + 'be freed at its last use and reused. That invariant is what makes the allocator here '
        + 'twenty lines instead of 30.4\'s graph colouring, and it is checked rather than '
        + 'assumed.',
      '**Arguments go in consecutive registers, which is a calling convention.** A call names a '
        + 'base register and a count, so the generator has to move each argument into place — '
        + 'and the moves it emits are real instructions that show up in the count. Lua does '
        + 'exactly this, and it is why a register bytecode has more `MOVE`s than you would '
        + 'expect.',
      '**A constant pool is deduplication, and it changes the size column.** Every literal, '
        + 'operator name, field-name list and closure descriptor is interned once and referred '
        + 'to by index. Without it a program with the same string in twenty places carries it '
        + 'twenty times, and the encoded-size comparison between two instruction sets stops '
        + 'meaning anything.',
      '**Fixed width can be indexed; variable width has to be walked.** A fixed encoding pads '
        + 'every instruction to the widest one, so the byte at offset 4n is an opcode and a '
        + 'jump target is an index. A variable encoding spends one byte on a small operand and '
        + 'two on a large one, is smaller, and cannot be decoded except from the start. Both '
        + 'ship in real runtimes and the demo prices them.',
      '**A superinstruction is the cheapest speed-up a bytecode VM has, and it costs opcode '
        + 'space.** Find the adjacent pairs that occur most often, give each one opcode, and '
        + 'the dispatch happens once instead of twice. The dial in the demo says what each one '
        + 'is worth, because a fused pair nobody executes is a bigger switch for nothing.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — two code generators, one IR',
        markup: root.BytecodeTemplate.render() },
      diagram: diagram(),
      insight: '**A register bytecode executes fewer, larger instructions, and that is worth '
        + 'more than the bytes it costs — but only because a dispatch is expensive.** The '
        + 'trade is entirely about the interpreter loop: fewer instructions means fewer trips '
        + 'through the switch, fewer mispredicted indirect branches and fewer operand decodes, '
        + 'and those dominate the cost of reading a slightly larger instruction. Lua 5.0 made '
        + 'exactly this move and reported a substantial win; the JVM and CPython did not, and '
        + 'both had good reasons — the JVM wants a bytecode its verifier can typecheck, and a '
        + 'stack shape is far easier to verify than a register file. Notice what that means: '
        + 'the "right" instruction set depends on what else the runtime needs from it, not on '
        + 'which one is faster in isolation. And notice where the argument reappears. RISC '
        + 'against CISC in M34 is the same question one level down — fewer, simpler operations '
        + 'against more expressive ones — decided by the same kind of measurement, and settled '
        + 'differently because the costs at that level are different.'
    };
  }

  function render(app) {
    application = app;
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.BytecodeTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const buildFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const program = root.Berugo.IrLower.compile(root.BytecodeTemplate.SAMPLES[parts[0]]).program;
    const options = { mode: parts[1], keepOnStack: parts[2] };

    return { program: program, compiled: root.Berugo.Bytecode.compile(program, options),
      reference: root.Berugo.IrInterp.run(program) };
  });

  const runFor = root.Helpers.memoise(function (key) {
    const state = buildFor(key);
    const out = root.Berugo.Vm.run(state.compiled, { budget: 400000 });

    return { out: out, agrees: root.Berugo.IrInterp.compare(state.reference, out).agree };
  });

  const bothFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return ['stack', 'register'].map(function (mode) {
      const inner = JSON.stringify([parts[0], mode, parts[1]]);
      const state = buildFor(inner);
      const run = runFor(inner);

      return { mode: mode, instructions: totalCode(state.compiled),
        bytes: totalBytes(state.compiled, parts[2]),
        dispatches: run.out.dispatches, agrees: run.agrees };
    });
  });

  function totalCode(compiled) {
    return Object.keys(compiled.chunks).reduce(function (sum, name) {
      return sum + compiled.chunks[name].code.length;
    }, 0);
  }

  function totalBytes(compiled, width) {
    return Object.keys(compiled.chunks).reduce(function (sum, name) {
      return sum + root.Berugo.Bytecode.encode(compiled.chunks[name], { width: width }).total;
    }, 0);
  }

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const program = root.Berugo.IrLower.compile(entry.source).program;
      const reference = root.Berugo.IrInterp.run(program);

      return Object.assign({ id: entry.id }, suiteRow(program, reference));
    });
  });

  function suiteRow(program, reference) {
    const modes = ['stack', 'register'].map(function (mode) {
      const compiled = root.Berugo.Bytecode.compile(program, { mode: mode });
      const out = root.Berugo.Vm.run(compiled, { budget: 400000 });

      return { instructions: totalCode(compiled), dispatches: out.dispatches,
        agrees: root.Berugo.IrInterp.compare(reference, out).agree };
    });

    return { stack: modes[0], register: modes[1],
      agrees: modes[0].agrees && modes[1].agrees };
  }

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['bd-sample'], values['bd-mode'],
      Boolean(values['bd-peephole'])]);
    const both = bothFor(JSON.stringify([values['bd-sample'], Boolean(values['bd-peephole']),
      values['bd-width']]));

    paintListing(key, values);
    paintMetrics(both, values, key);
    paintChart(both);
    paintSuite();
    paintPairs(key, Number(values['bd-supers']));
    paintDesigns();
  }

  function paintListing(key, values) {
    const state = buildFor(key);
    const chunk = state.compiled.chunks[state.compiled.main];

    root.AstView.render(document.getElementById('bd-listing'),
      root.BytecodeView.listing(root.Berugo.Bytecode.disassemble(chunk)));

    root.Helpers.setText('bd-listing-caption',
      'The ' + values['bd-mode'] + ' encoding of `main`: ' + chunk.code.length +
      ' instructions over ' + chunk.constants.length + ' pooled constants and ' +
      chunk.slots.length + ' named locals' +
      (values['bd-mode'] === 'register' ? ', using ' + chunk.registers + ' virtual registers.'
        : '. `STORE_TEMP` and `LOAD_TEMP` are the scratch slots a stack machine needs for a '
          + 'value another instruction in the block still reads.'));
  }

  function paintMetrics(both, values, key) {
    const run = runFor(key);

    root.MetricGrid.update({
      'bd-instructions': { value: both[0].instructions + ' / ' + both[1].instructions,
        note: 'stack against register, on this program' },
      'bd-dispatches': { value: both[0].dispatches + ' / ' + both[1].dispatches,
        note: ratioNote(both) },
      'bd-bytes': { value: both[0].bytes + ' / ' + both[1].bytes + ' bytes',
        note: values['bd-width'] + ' width, code plus the constant pool' },
      'bd-agrees': { value: run.agrees ? 'yes' : 'NO',
        note: 'the chosen set runs to what the IR interpreter ran to' }
    });
  }

  function ratioNote(both) {
    if (!both[1].dispatches) return 'nothing executed';
    const ratio = both[0].dispatches / both[1].dispatches;

    return 'the register set executes ' + ratio.toFixed(2) + '× fewer';
  }

  function paintChart(both) {
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.BytecodeView.bars(document.getElementById('bd-chart'), {
      lazyLib: application.lazyLib,
      series: ['instructions', 'dispatches'],
      rows: both.map(function (row) {
        return { label: row.mode, instructions: row.instructions,
          dispatches: row.dispatches };
      }),
      summary: 'Instructions in blue, executed dispatches in amber, for both sets.' });

    root.Helpers.setText('bd-chart-caption',
      'Instructions in blue and executed dispatches in amber. The two bars for one set are the '
      + 'static size and the dynamic cost, and they move apart on a loop: a program that runs '
      + 'its body twenty times pays the dispatch twenty times and the size once.');
  }

  function paintSuite() {
    const rows = suiteFor();

    root.jQuery('#bd-suite tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' +
        row.stack.instructions + '</td><td class="mono">' + row.register.instructions +
        '</td><td class="mono">' + row.stack.dispatches + '</td><td class="mono">' +
        row.register.dispatches + '</td><td>' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bd-suite-caption', suiteCaption(rows));
  }

  function suiteCaption(rows) {
    const totals = rows.reduce(function (into, row) {
      return { si: into.si + row.stack.instructions, ri: into.ri + row.register.instructions,
        sd: into.sd + row.stack.dispatches, rd: into.rd + row.register.dispatches,
        ok: into.ok + (row.agrees ? 1 : 0) };
    }, { si: 0, ri: 0, sd: 0, rd: 0, ok: 0 });

    return totals.ok + ' of ' + rows.length + ' programs give the same answer in both sets. '
      + 'Across the suite the stack set is ' + totals.si + ' instructions against '
      + totals.ri + ' and ' + totals.sd + ' dispatches against ' + totals.rd + ' — '
      + (totals.sd / totals.rd).toFixed(2) + '× the dispatch for '
      + (totals.si / totals.ri).toFixed(2) + '× the instructions. The agreement column is not '
      + 'decoration: a code generator that drops an instruction gets a smaller number in every '
      + 'other column, and only the differential says whether the smaller number is a saving.';
  }

  function paintPairs(key, supers) {
    const state = buildFor(key);
    const chunk = state.compiled.chunks[state.compiled.main];
    const pairs = root.Berugo.Bytecode.pairFrequencies(chunk);
    const chosen = root.Berugo.Bytecode.fuse(chunk, supers);

    root.jQuery('#bd-pairs tbody').html(pairs.slice(0, 8).map(function (row, at) {
      return '<tr><td class="mono">' + row.pair + '</td><td class="mono">' + row.count +
        '</td><td class="mono">' + (at < supers ? row.count : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="3">no adjacent pair repeats in this program</td></tr>');

    root.Helpers.setText('bd-pairs-caption',
      pairs.length + ' distinct adjacent pairs, and fusing the top ' + supers + ' would remove '
      + chosen.saved + ' of the ' + chunk.code.length + ' dispatches this function issues. '
      + 'The dial is the point: each fused pair is another opcode in the switch and another '
      + 'case a verifier has to know about, so a real VM fuses the handful that pay and leaves '
      + 'the tail alone.');
  }

  function paintDesigns() {
    root.jQuery('#bd-designs tbody').html(DESIGNS.map(function (row) {
      return '<tr><td class="mono">' + row.runtime + '</td><td>' + row.shape + '</td><td>' +
        row.encoding + '</td><td>' + row.bought + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bd-designs-caption',
      'Four production bytecodes, two of each shape. Reading the last column is the useful '
      + 'direction: none of them chose a shape because it was faster in the abstract, they '
      + 'chose it because of what else the runtime needed — a typecheckable stream, a compact '
      + 'input for a second tier, or an interpreter loop with fewer trips through it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));

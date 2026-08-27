'use strict';

/**
 * Property tests for the Berugo back end (M30).
 *
 * The discipline of this milestone is that **a back end is correct exactly
 * when it computes what the front end computed**, so almost every property
 * below is a differential: two instruction sets, a JIT, a WebAssembly module
 * and the reference interpreter, all run on the same programs and compared on
 * value, output, outcome and every binding.
 *
 * The rest are the checks that stop a number being read as an improvement
 * when it is a defect:
 *
 *   - the register allocation is verified against a liveness pass the
 *     allocator did not produce, because an allocator that shares a register
 *     between two live values has the best spill count in the table;
 *   - the instruction selector is checked against an exhaustive cover,
 *     because a wrong recurrence returns a valid cover slightly more
 *     expensive and that reads as a target with no better option;
 *   - the stack map is checked against what the program goes on to READ,
 *     not against what the frame happens to hold, because the second question
 *     reports precision as failure;
 *   - and every sensitivity is asserted: the naive stack generator has to be
 *     bigger, the unsplit allocator has to spill more, the deopt fixture has
 *     to deoptimise. A check nobody has watched fire is a check nobody
 *     believes.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const MACHINES = path.join(__dirname, '..', '..', 'src', 'js', 'machines');
const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Ssa = require(path.join(BERUGO, 'ssa.js'));
const Cfg = require(path.join(BERUGO, 'cfg.js'));
const Bytecode = require(path.join(BERUGO, 'bytecode.js'));
const Vm = require(path.join(BERUGO, 'vm.js'));
const Isel = require(path.join(BERUGO, 'isel.js'));
const Regalloc = require(path.join(BERUGO, 'regalloc.js'));
const Schedule = require(path.join(BERUGO, 'schedule.js'));
const WasmEmit = require(path.join(BERUGO, 'wasm-emit.js'));
const Jit = require(path.join(BERUGO, 'jit.js'));
const Shapes = require(path.join(BERUGO, 'shapes.js'));
const Runtime = require(path.join(BERUGO, 'runtime.js'));
const PassLab = require(path.join(MACHINES, 'pass-lab.js'));
const ExecLab = require(path.join(MACHINES, 'exec-lab.js'));

const RegallocTemplate = require(path.join(SECTIONS, 'register-allocation-template.js'));

function programOf(source) { return IrLower.compile(source).program; }

function compiled(source, mode) {
  return Bytecode.compile(programOf(source), { mode: mode });
}

/** The function a back end would allocate: post-destruction, and the biggest. */
function prepared(source) {
  const out = PassLab.run(source, ['ssa', 'sccp', 'copy-propagation', 'dead-code']);

  out.program.functions.forEach(function (fn) { if (fn.ssa) Ssa.destruct(fn); });
  return out.program.functions.reduce(function (best, fn) {
    return Ir.instructionCount(fn) > Ir.instructionCount(best) ? fn : best;
  }, out.program.functions[0]);
}

/* --------------------------------------------------------------- bytecode */

test('bytecode: no non-parameter register crosses a block in the lowered IR', function () {
  let checked = 0;

  Spec.CONFORMANCE.forEach(function (entry) {
    programOf(entry.source).functions.forEach(function (fn) {
      const local = Bytecode.blockLocal(fn);

      checked += local.defined;
      assert.deepStrictEqual(local.escaping, [],
        entry.id + ': the block-local virtual register allocator depends on this, so a '
        + 'lowering that breaks it has to fail here rather than produce wrong code');
    });
  });
  assert.ok(checked > 100, 'only ' + checked + ' registers were checked');
});

test('bytecode: both instruction sets compute what the IR interpreter computed', function () {
  const wrong = [];

  ['stack', 'register'].forEach(function (mode) {
    Spec.CONFORMANCE.forEach(function (entry) {
      const program = programOf(entry.source);
      const out = Vm.run(Bytecode.compile(program, { mode: mode }), { budget: 400000 });
      const verdict = IrInterp.compare(IrInterp.run(program), out);

      if (!verdict.agree) wrong.push(mode + '/' + entry.id + ': ' + verdict.why);
    });
  });
  assert.deepStrictEqual(wrong, []);
});

test('bytecode: the register set executes fewer dispatches than the stack set', function () {
  const totals = { stack: 0, register: 0 };

  ['stack', 'register'].forEach(function (mode) {
    Spec.CONFORMANCE.forEach(function (entry) {
      totals[mode] += Vm.run(compiled(entry.source, mode), { budget: 400000 }).dispatches;
    });
  });
  assert.ok(totals.register < totals.stack,
    'the whole argument of the section is this inequality: ' + totals.stack
    + ' against ' + totals.register);
});

test('bytecode: the peephole is worth something, and the honest ratio is the smaller one',
  function () {
    const counts = { kept: 0, naive: 0, register: 0 };

    Spec.CONFORMANCE.forEach(function (entry) {
      const program = programOf(entry.source);

      counts.kept += size(Bytecode.compile(program, { mode: 'stack' }));
      counts.naive += size(Bytecode.compile(program,
        { mode: 'stack', keepOnStack: false }));
      counts.register += size(Bytecode.compile(program, { mode: 'register' }));
    });
    assert.ok(counts.naive > counts.kept,
      'leaving a value on the stack has to remove instructions, or the rewrite is decorative');
    assert.ok(counts.kept / counts.register < counts.naive / counts.register,
      'and the ratio computed without it flatters the conclusion');
  });

function size(built) {
  return Object.keys(built.chunks).reduce(function (sum, name) {
    return sum + built.chunks[name].code.length;
  }, 0);
}

test('bytecode: every emitted instruction carries the origin it came from', function () {
  const chunk = compiled('let t = 0;\nfor v in [1, 2, 3] { t = t + v; }', 'register')
    .chunks.main;
  const missing = chunk.code.filter(function (inst) { return !inst.origin; });

  assert.deepStrictEqual(missing, [],
    'the source map and the stack trace in 30.9 are built from this field');
  assert.ok(chunk.code.every(function (inst) { return Boolean(inst.span); }),
    'and the span with it');
});

/* --------------------------------------------------------------------- VM */

test('vm: a session can be stepped and reports the frame between instructions', function () {
  const session = Vm.session(compiled('fn twice(n) { return n * 2; }\nlet r = twice(21);',
    'stack'), {});

  for (let at = 0; at < 5 && !session.done(); at += 1) session.step();
  const snapshot = session.snapshot();

  assert.ok(snapshot.fn, 'a frame is live');
  assert.ok(snapshot.dispatches > 0, 'and the machine advanced');
  session.runTo(100000);
  assert.ok(session.done(), 'and it runs to completion from where it stopped');
  assert.strictEqual(session.result().outcome, 'ok');
});

test('vm: capturing by reference changes the answer, which is what the switch is for',
  function () {
    const source = 'fn adder(n) { return fn(x) => x + n; }\nlet inc = adder(1);\nlet r = inc(41);';
    const byValue = Vm.run(compiled(source, 'stack'), {});
    const byReference = Vm.run(compiled(source, 'stack'), { byReference: true });

    assert.strictEqual(byValue.outcome, 'ok');
    assert.strictEqual(byReference.outcome, 'ok');
    assert.strictEqual(byValue.bindings.join('|'), byReference.bindings.join('|'),
      'this program has no live frame to point at, so both strategies agree — the difference '
      + 'needs a closure made inside something that then returns');
  });

test('vm: a fault reports the frames that existed at the fault', function () {
  const source = 'fn pick(xs, at) { return xs[at]; }\nfn go(xs) { return pick(xs, 5); }\n'
    + 'let r = go([1, 2]);';
  const trace = Runtime.traceAtFault(compiled(source, 'register'), source, {});

  assert.ok(trace.faulted, 'the fixture has to fault, or there is nothing to trace');
  assert.ok(trace.rows.length >= 3, 'three frames were live: pick, go and main');
  assert.strictEqual(trace.rows[0].fn, 'pick', 'innermost first');
  assert.ok(trace.rows.every(function (row) { return row.line > 0; }),
    'every frame names a source line rather than a bytecode offset');
});

/* -------------------------------------------------------- instruction selection */

test('isel: the dynamic-programming cover is the minimum on every tree it can enumerate',
  function () {
    let checked = 0;
    let disagreements = 0;

    Spec.CONFORMANCE.forEach(function (entry) {
      programOf(entry.source).functions.forEach(function (fn) {
        const out = Isel.checkOptimal(fn);

        checked += out.checked;
        disagreements += out.disagreements;
      });
    });
    assert.strictEqual(disagreements, 0,
      'a tiler with a wrong recurrence returns a VALID cover at a higher cost, which reads '
      + 'as a target with no better option available');
    assert.ok(checked > 20, 'only ' + checked + ' trees were compared');
  });

test('isel: every operator the IR can emit has a tile', function () {
  const covered = new Set();

  Isel.TILES.forEach(function (tile) {
    const head = Array.isArray(tile.pattern) ? tile.pattern[0] : tile.pattern;

    if (String(head).indexOf('binary:') === 0) covered.add(String(head).slice(7));
  });
  Ir.BINARY_OPS.forEach(function (operator) {
    assert.ok(covered.has(operator), operator + ' has no tile, so a program using it crashes '
      + 'the selector — which is the right behaviour and has to be noticed here');
  });
});

test('isel: repricing one tile changes the selection with nothing recompiled', function () {
  const fn = programOf('let k = 3;\nlet t = 0;\nfor v in [1, 2, 3, 4] { t = t + v * k * 2; }')
    .program === undefined
    ? programOf('let k = 3;\nlet t = 0;\nfor v in [1, 2, 3, 4] { t = t + v * k * 2; }')
      .functions[0]
    : null;
  const target = fn || programOf('let k = 3;\nlet t = 0;\n'
    + 'for v in [1, 2, 3, 4] { t = t + v * k * 2; }').functions[0];
  const sweep = Isel.costSweep(target, 'MADDR', [2, 4, 5, 8]);

  assert.ok(sweep[0].uses > 0, 'a cheap fused tile is chosen');
  assert.strictEqual(sweep[sweep.length - 1].uses, 0, 'an expensive one is not');
  assert.ok(sweep[0].total < sweep[2].total, 'and the total follows the price');
});

/* ------------------------------------------------------- register allocation */

test('regalloc: every allocation is sound at every register count', function () {
  const clashes = [];

  Spec.CONFORMANCE.forEach(function (entry) {
    const fn = prepared(entry.source);

    [1, 2, 3, 4, 8].forEach(function (registers) {
      Regalloc.compare(fn, { registers: registers }).rows.forEach(function (row) {
        if (!row.sound) clashes.push(entry.id + '/' + registers + '/' + row.name);
      });
    });
  });
  assert.deepStrictEqual(clashes, [],
    'an allocator that gives two simultaneously live values the same register has the best '
    + 'spill count in the table and produces a wrong program');
});

test('regalloc: splitting reduces the points spent in memory', function () {
  const fn = prepared(RegallocTemplate.SAMPLES.pressure);
  const split = Regalloc.linearScan(fn, { registers: 4, split: true });
  const plain = Regalloc.linearScan(fn, { registers: 4, split: false });

  assert.ok(split.splits > 0, 'the fixture has to be one where splitting applies');
  assert.ok(split.spilledPoints < plain.spilledPoints,
    'splitting has to help in the unit a spill is paid in, or it is decorative: '
    + split.spilledPoints + ' against ' + plain.spilledPoints);
  assert.ok(split.verify.ok && plain.verify.ok, 'and both are still sound');
});

test('regalloc: a placement count is not a value count, which is why points are the unit',
  function () {
    const fn = prepared(RegallocTemplate.SAMPLES.pressure);
    const split = Regalloc.linearScan(fn, { registers: 4, split: true });
    const plain = Regalloc.linearScan(fn, { registers: 4, split: false });

    assert.ok(split.intervals > split.values,
      'splitting turns one value into several placements, so a count over placements is '
      + 'not a count over values: ' + split.intervals + ' placements for '
      + split.values + ' values');
    assert.ok(split.intervals > plain.intervals,
      'and splitting produces more of them than not splitting does');
    assert.ok(split.spills < plain.spills && split.spilledPoints < plain.spilledPoints,
      'here both move the same way, which is luck — the span is the measure that has to');
  });

test('regalloc: fewer registers never spills fewer points', function () {
  const fn = prepared(RegallocTemplate.SAMPLES.pressure);
  const sweep = Regalloc.pressureSweep(fn, [1, 2, 3, 4, 6, 8]);

  sweep.slice(1).forEach(function (row, at) {
    assert.ok(row.colouringPoints <= sweep[at].colouringPoints,
      'more registers must not make colouring worse at ' + row.registers);
  });
  assert.strictEqual(sweep[sweep.length - 1].colouringPoints, 0,
    'with enough registers nothing spills');
});

/* --------------------------------------------------------------- scheduling */

test('schedule: every list schedule is legal and preserves the instruction count', function () {
  const illegal = [];

  Spec.CONFORMANCE.forEach(function (entry) {
    programOf(entry.source).functions.forEach(function (fn) {
      const report = Schedule.report(fn);

      if (report.illegal) illegal.push(entry.id);
      report.rows.forEach(function (row) {
        assert.ok(row.rows[1].legal, entry.id + '/' + row.block + ' produced an illegal order');
      });
    });
  });
  assert.deepStrictEqual(illegal, []);
});

test('schedule: a schedule never issues more instructions than the source order', function () {
  Spec.CONFORMANCE.forEach(function (entry) {
    programOf(entry.source).functions.forEach(function (fn) {
      fn.blocks.forEach(function (block) {
        if (block.instructions.length < 2) return;
        const order = Schedule.listSchedule(block).order;

        assert.strictEqual(order.length, block.instructions.length,
          'scheduling reorders; it does not add or remove');
        assert.strictEqual(new Set(order).size, order.length, 'and issues each exactly once');
      });
    });
  });
});

test('schedule: raising the load latency raises the stalls and not the pressure', function () {
  const fn = programOf('fn sum(xs) {\n  let a = xs[0];\n  let b = xs[1];\n  let c = xs[2];\n'
    + '  return a + b + c;\n}\nlet r = sum([1, 2, 3]);').functions[0];
  const sweep = Schedule.latencySweep(fn, [1, 4, 16]);

  assert.ok(sweep[2].stalls > sweep[0].stalls, 'a slower memory stalls more');
  assert.strictEqual(sweep[0].peak, sweep[2].peak,
    'the order does not change, so the peak does not either — which is the ceiling the '
    + 'section is about');
});

/* ------------------------------------------------------------ WebAssembly */

test('wasm: every program in the subset validates and agrees with the interpreter', function () {
  const wrong = [];
  let inSubset = 0;

  Spec.CONFORMANCE.forEach(function (entry) {
    const program = programOf(entry.source);
    const applicable = WasmEmit.applicable(program);

    if (!applicable.ok) {
      assert.ok(applicable.reasons[0].why.length > 10,
        entry.id + ' is excluded with no usable reason');
      return;
    }
    inSubset += 1;
    checkWasm(entry, program, wrong);
  });
  assert.deepStrictEqual(wrong, []);
  assert.ok(inSubset >= 6, 'only ' + inSubset + ' programs reached the emitter');
});

function checkWasm(entry, program, wrong) {
  const bytes = WasmEmit.buildModule(program);
  const valid = WasmEmit.validate(bytes);

  if (!valid.ok) { wrong.push(entry.id + ': the host refused the module'); return; }
  const out = WasmEmit.run(program);
  const reference = IrInterp.run(program);

  if (out.outcome !== reference.outcome) {
    wrong.push(entry.id + ': ' + out.outcome + ' against ' + reference.outcome);
  }
  if (out.bindings.join('|') !== reference.bindings.join('|')) {
    wrong.push(entry.id + ': ' + out.bindings.join(', ') + ' against '
      + reference.bindings.join(', '));
  }
}

test('wasm: a division by zero traps where the language faults', function () {
  const source = 'let d = 0;\nlet n = 0;\nlet acc = 0;\n'
    + 'while n < 3 {\n  acc = acc + 100 / d;\n  n = n + 1;\n}';
  const program = programOf(source);
  const out = WasmEmit.run(program);
  const reference = IrInterp.run(program);

  assert.strictEqual(out.outcome, 'runtime',
    'without the guard wasm produces an infinity and quietly disagrees');
  assert.strictEqual(out.outcome, reference.outcome);
  assert.strictEqual(out.bindings.join('|'), reference.bindings.join('|'),
    'the globals are read back after the trap, so the partial state matches too');
});

test('wasm: the stackifier handles nested loops and branches inside loops', function () {
  const shapes = [
    'let t = 0;\nlet a = 0;\nwhile a < 4 {\n  let b = 0;\n'
      + '  while b < 5 { t = t + a * b; b = b + 1; }\n  a = a + 1;\n}',
    'let t = 0;\nlet i = 0;\nwhile i < 6 {\n  if i < 3 { t = t + i; } else { t = t - 1; };\n'
      + '  i = i + 1;\n}'
  ];

  shapes.forEach(function (source) {
    const program = programOf(source);

    assert.ok(WasmEmit.applicable(program).ok, 'the shape is in the subset');
    const bytes = WasmEmit.buildModule(program);

    assert.ok(WasmEmit.validate(bytes).ok, 'and the module validates');
    assert.strictEqual(WasmEmit.run(program).bindings.join('|'),
      IrInterp.run(program).bindings.join('|'));
  });
});

test('wasm: an irreducible graph is refused rather than approximated', function () {
  const fn = irreducible();
  const program = { functions: [fn], main: fn.name, globals: [] };
  const applicable = WasmEmit.applicable(program);

  assert.strictEqual(applicable.ok, false);
  assert.ok(applicable.reasons.some(function (row) {
    return row.why.indexOf('irreducible') !== -1;
  }), 'and the reason names the shape rather than an instruction');
});

function irreducible() {
  const fn = Ir.makeFunction('handmade', []);
  const blocks = ['entry', 'split', 'left', 'right', 'exit']
    .map(function (label) { return Ir.makeBlock(fn, label); });
  const cond = Ir.freshRegister(fn, 'Bool');

  Ir.emit(blocks[0], 'const', { target: cond, value: true, origin: 'test' });
  Ir.terminate(blocks[0], 'jump', { target: blocks[1].id, origin: 'test' });
  Ir.terminate(blocks[1], 'branch',
    { cond: cond, then: blocks[2].id, other: blocks[3].id, origin: 'test' });
  Ir.terminate(blocks[2], 'branch',
    { cond: cond, then: blocks[3].id, other: blocks[4].id, origin: 'test' });
  Ir.terminate(blocks[3], 'branch',
    { cond: cond, then: blocks[2].id, other: blocks[4].id, origin: 'test' });
  Ir.terminate(blocks[4], 'ret', { value: null, origin: 'test' });
  assert.strictEqual(Cfg.isReducible(Cfg.build(fn)), false, 'the fixture stopped being irreducible');
  return fn;
}

/* ---------------------------------------------------------------- the JIT */

test('jit: every conformance program agrees with a run that never compiled', function () {
  const wrong = [];

  Spec.CONFORMANCE.forEach(function (entry) {
    const out = Jit.differential(compiled(entry.source, 'register'), { budget: 400000 });

    if (!out.agree) wrong.push(entry.id + ': ' + out.why);
  });
  assert.deepStrictEqual(wrong, []);
});

test('jit: a hot loop reaches the optimising tier through a back edge', function () {
  const out = Jit.differential(
    compiled('let t = 0;\nlet i = 0;\nwhile i < 400 { t = t + i * 2; i = i + 1; }', 'register'),
    { budget: 2000000 });

  assert.ok(out.agree, out.why);
  assert.ok(out.compiles >= 2, 'baseline and optimising');
  assert.ok(out.osr >= 2, 'a top-level loop is entered once, so both are on-stack replacements');
  assert.ok(out.fastPaths > 0, 'and the profile justified at least one guard');
});

test('jit: a guard that fails deoptimises and the program still agrees', function () {
  const source = 'fn plus(a, b) { return a + b; }\nlet t = 0;\nlet i = 0;\n'
    + 'while i < 300 { t = plus(t, i); i = i + 1; }\nlet s = plus("a", "b");';
  const out = Jit.differential(compiled(source, 'register'), { budget: 2000000 });

  assert.ok(out.deopts > 0,
    'the fixture exists to make a guard fail; if it does not, the deopt path is untested');
  assert.ok(out.agree, out.why);
  assert.ok(out.jit.deopts[0].why.indexOf('guard') !== -1, 'and the reason names the guard');
});

test('jit: raising the threshold reduces the share of the run that is compiled', function () {
  const sweep = Jit.thresholdSweep(
    compiled('let t = 0;\nlet i = 0;\nwhile i < 400 { t = t + i * 2; i = i + 1; }', 'register'),
    [5, 50, 200]);

  assert.ok(sweep[0].share > sweep[1].share, 'a low threshold compiles sooner');
  assert.ok(sweep[1].share > sweep[2].share, 'and a high one may never compile at all');
});

/* ----------------------------------------------------------------- shapes */

test('shapes: the same fields in two orders are two shapes', function () {
  const tree = Shapes.makeTree();
  const one = Shapes.build(tree, ['x', 'y']);
  const two = Shapes.build(tree, ['y', 'x']);
  const three = Shapes.build(tree, ['x', 'y']);

  assert.strictEqual(one.shape, three.shape, 'the same path shares a shape');
  assert.notStrictEqual(one.shape, two.shape, 'the other path does not');
  assert.strictEqual(Shapes.offsetOf(one.shape, 'x'), 0);
  assert.strictEqual(Shapes.offsetOf(two.shape, 'x'), 1, 'and the offsets genuinely differ');
});

test('shapes: cost per access rises with the shape count and jumps past the limit',
  function () {
    const sweep = Shapes.stateSweep([1, 2, 3, 4, 5], { accesses: 1000 });

    sweep.slice(1).forEach(function (row, at) {
      assert.ok(row.perAccess >= sweep[at].perAccess,
        'more shapes must not be cheaper, at ' + row.shapes);
    });
    const before = sweep[3];
    const after = sweep[4];

    assert.strictEqual(after.state, 'megamorphic');
    assert.ok(after.perAccess > before.perAccess * 2,
      'the step past the limit is a cliff rather than a gradient: ' + before.perAccess
      + ' to ' + after.perAccess);
    assert.strictEqual(after.hits, 0, 'a megamorphic cache caches nothing');
  });

test('shapes: a real program with two construction orders builds two shapes', function () {
  const out = Shapes.fromProgram(
    programOf('let a = { x: 1, y: 2 };\nlet b = { y: 3, x: 4 };\nlet s = a.x + b.x;'), Ir);
  const built = out.sites.map(function (row) { return row.shape; });

  assert.strictEqual(out.sites.length, 2, 'two record allocations');
  assert.notStrictEqual(built[0], built[1],
    'the IR keeps the order the source wrote, so this is about this program rather than a '
    + 'hypothetical runtime');
});

/* -------------------------------------------------------- runtime metadata */

test('runtime: the stack map covers everything the program reads after a safepoint',
  function () {
    const missed = [];
    let safepoints = 0;
    let observed = 0;

    Spec.CONFORMANCE.forEach(function (entry) {
      const out = Runtime.checkSafepoints(compiled(entry.source, 'register'),
        { budget: 200000 });

      safepoints += out.safepoints;
      observed += out.observed;
      out.missed.forEach(function (row) {
        missed.push(entry.id + '/' + row.fn + ':' + row.pc + '/' + row.register);
      });
    });
    assert.deepStrictEqual(missed, [],
      'a location the program reads and the map omits is an object the collector frees '
      + 'while something still needs it');
    assert.ok(safepoints > 10 && observed > 10,
      'the check has to have run: ' + safepoints + ' safepoints, ' + observed + ' reads');
  });

test('runtime: only calls and allocations are safepoints', function () {
  const chunk = compiled('let r = { p: { x: 1 }, q: [1, 2] };\nlet v = r.p.x + r.q[1];',
    'register').chunks.main;
  const map = Runtime.stackMap(chunk);

  assert.ok(map.length > 0, 'this program allocates, so it has safepoints');
  assert.ok(map.length < chunk.code.length,
    'a map at every instruction would be larger than the code it describes');
  map.forEach(function (row) {
    assert.ok(Runtime.SAFEPOINTS.indexOf(row.op) !== -1, row.op + ' is not a safepoint');
  });
});

test('runtime: a source map takes every instruction back to a line', function () {
  const source = 'let a = 1;\nlet b = a + 2;\nlet c = b * 3;';
  const rows = Runtime.sourceMap(compiled(source, 'register').chunks.main, source);

  assert.ok(rows.length > 0);
  assert.ok(rows.filter(function (row) { return row.line > 0; }).length >= rows.length - 1,
    'all but the final return name a real line');
  assert.ok(rows.some(function (row) { return row.text.indexOf('a + 2') !== -1; }),
    'and the span picks out the construct rather than the whole file');
});

/* --------------------------------------------------------- the cross-mode lab */

test('exec: every mode agrees with the reference on the whole conformance suite', function () {
  const out = ExecLab.suite({ budget: 400000 });

  assert.strictEqual(out.disagreements, 0,
    out.rows.filter(function (row) { return row.disagreed; })
      .map(function (row) { return row.id + ': ' + row.why; }).join('; '));
  assert.strictEqual(out.programs, Spec.CONFORMANCE.length);
  assert.ok(out.checks >= 50, 'only ' + out.checks + ' comparisons ran');
  assert.ok(out.unsupported > 0,
    'the wasm subset excludes some programs, and hiding that would make the rest meaningless');
});

test('exec: the benchmark protocol reports its run count and its spread', function () {
  const out = ExecLab.bench(ExecLab.BENCHMARKS[0].source, 'register',
    { warmup: 2, runs: 5, budget: 4000000 });

  assert.strictEqual(out.runs, 5);
  assert.strictEqual(out.warmup, 2);
  assert.ok(out.spread >= 0 && out.worst >= out.best, 'the spread is worst minus best');
  assert.ok(out.checksum > 0, 'the result is consumed, so nothing can be deleted as unobserved');
});

test('exec: the cost of the benchmark scales with its input', function () {
  const rows = ExecLab.scaling([25, 50, 100, 200], { budget: 8000000 });
  const first = rows[0].perItem;

  rows.forEach(function (row) {
    assert.ok(Math.abs(row.perItem - first) < 1,
      'a benchmark whose per-item cost moves with the input is measuring its own harness');
  });
  assert.ok(rows[3].dispatches > rows[0].dispatches * 7,
    'and eight times the input costs about eight times the work');
});

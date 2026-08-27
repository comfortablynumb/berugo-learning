'use strict';

/**
 * Every figure the 30.5–30.7 content quotes, recomputed from the modules —
 * and then asserted to still appear in the prose.
 *
 * Two of these are claims about coverage rather than about correctness, and
 * both are worthless without their sensitivity: the WebAssembly subset is
 * only meaningful beside the count of what it excludes, and the JIT's
 * agreement is only meaningful beside the count of guards it emitted.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const support = require('../support/worked-example-prose.js');

const CONTENT = path.join(__dirname, '..', '..', 'src', 'js', 'content');
['concepts-back-end-target', 'examples-back-end-target']
  .forEach(function (file) { require(path.join(CONTENT, file + '.js')); });

const BERUGO = path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'berugo');
const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');

const Spec = require(path.join(BERUGO, 'spec.js'));
const Ir = require(path.join(BERUGO, 'ir.js'));
const IrLower = require(path.join(BERUGO, 'ir-lower.js'));
const IrInterp = require(path.join(BERUGO, 'ir-interp.js'));
const Cfg = require(path.join(BERUGO, 'cfg.js'));
const Bytecode = require(path.join(BERUGO, 'bytecode.js'));
const Schedule = require(path.join(BERUGO, 'schedule.js'));
const WasmEmit = require(path.join(BERUGO, 'wasm-emit.js'));
const Jit = require(path.join(BERUGO, 'jit.js'));

const ScheduleTemplate = require(path.join(SECTIONS, 'machine-scheduling-template.js'));
const WasmTemplate = require(path.join(SECTIONS, 'targeting-webassembly-template.js'));
const JitTemplate = require(path.join(SECTIONS, 'jit-compilation-template.js'));

function programOf(source) { return IrLower.compile(source).program; }

function biggest(source) {
  const program = programOf(source);

  return program.functions.reduce(function (best, fn) {
    return Ir.instructionCount(fn) > Ir.instructionCount(best) ? fn : best;
  }, program.functions[0]);
}

/* -------------------------------------------------------- 30.5 scheduling */

test('figures: the loads fixture goes 34 cycles to 32 and its peak 2 to 3', function () {
  const fn = biggest(ScheduleTemplate.SAMPLES.loads);
  const options = { latency: { loadIndex: 4, loadField: 4 }, priority: 'critical' };
  const block = fn.blocks.reduce(function (best, entry) {
    return entry.instructions.length > best.instructions.length ? entry : best;
  }, fn.blocks[0]);
  const rows = Schedule.compareBlock(block, options).rows;

  assert.strictEqual(rows[0].cycles, 34);
  assert.strictEqual(rows[1].cycles, 32);
  assert.strictEqual(rows[0].stalls, 16);
  assert.strictEqual(rows[1].stalls, 14);
  assert.strictEqual(rows[0].peak, 2);
  assert.strictEqual(rows[1].peak, 3);
  assert.strictEqual(rows[1].legal, true);
  assert.strictEqual(block.instructions.length, 18);
  assert.strictEqual(Schedule.dagOf(block, options).edges, 28);

  support.quotes('machine-scheduling',
    ['34 cycles in source order against 32 scheduled',
      '16 stalls against 14', '2 live values against 3',
      '0 dependence violations across 28 edges', '18 either way']);
});

test('figures: the saving is two cycles at every load latency', function () {
  const fn = biggest(ScheduleTemplate.SAMPLES.loads);
  const sweep = Schedule.latencySweep(fn, [1, 4, 8, 16]);
  const byLatency = {};

  sweep.forEach(function (row) { byLatency[row.latency] = row; });
  assert.strictEqual(byLatency[1].cycles, 23);
  assert.strictEqual(byLatency[16].cycles, 68);
  assert.strictEqual(byLatency[1].stalls, 5);
  assert.strictEqual(byLatency[16].stalls, 50);
  sweep.forEach(function (row) {
    assert.strictEqual(row.saved, 2,
      'the saving is bounded by the independent work in the block, not by the latency');
    assert.strictEqual(row.peak, 3, 'and the order does not change, so the peak does not');
  });

  support.quotes('machine-scheduling',
    ['23 cycles against 68', '2 at every single latency, from 1 to 16',
      '5 stalls at latency 1 and 50 at latency 16',
      '3 at every latency — it is the same order in every row']);
});

/* ------------------------------------------------------- 30.6 WebAssembly */

test('figures: the loop fixture is 237 bytes over five sections', function () {
  const program = programOf(WasmTemplate.SAMPLES.loop);
  const bytes = WasmEmit.buildModule(program);
  const sections = WasmEmit.sectionSizes(bytes);
  const byName = {};

  sections.forEach(function (row) { byName[row.name] = row.size; });
  assert.strictEqual(bytes.length, 237);
  assert.strictEqual(sections.length, 5);
  assert.strictEqual(byName.code, 168);
  assert.strictEqual(WasmEmit.validate(bytes).ok, true);
  assert.strictEqual(WasmEmit.run(program).bindings.join('|'),
    IrInterp.run(program).bindings.join('|'));
  assert.strictEqual(IrInterp.run(program).bindings.join(', '), 'i = 20, t = 380');

  support.quotes('targeting-webassembly',
    ['237 bytes over 5 sections, of which 168 are code',
      'valid, and both bindings agree — i = 20 and t = 380']);
});

test('figures: four blocks, one loop, three emitted inline', function () {
  const fn = programOf(WasmTemplate.SAMPLES.loop).functions[0];
  const graph = Cfg.build(fn);
  const headers = new Set(Cfg.backEdges(graph).map(function (edge) { return edge.to; }));
  const merges = graph.blocks.filter(function (id) {
    return (graph.preds[id] || []).length > 1;
  });

  assert.strictEqual(graph.blocks.length, 4);
  assert.strictEqual(headers.size, 1);
  assert.deepStrictEqual(merges, Array.from(headers),
    'the one merge point here is the loop header, reached from the entry and the latch');
  assert.strictEqual(graph.blocks.length - headers.size, 3);

  support.quotes('targeting-webassembly',
    ['4 blocks', '1 — and it is also a merge point, reached from the entry and the latch',
      '3 of the 4']);
});

test('figures: eight of seventeen programs compile, and nine carry a reason', function () {
  const rows = Spec.CONFORMANCE.map(function (entry) {
    const program = programOf(entry.source);
    const applicable = WasmEmit.applicable(program);

    if (!applicable.ok) return { id: entry.id, inSubset: false, why: applicable.reasons[0].why };
    const bytes = WasmEmit.buildModule(program);
    const out = WasmEmit.run(program);
    const reference = IrInterp.run(program);

    return { id: entry.id, inSubset: true, bytes: bytes.length,
      valid: WasmEmit.validate(bytes).ok,
      agrees: out.outcome === reference.outcome
        && out.bindings.join('|') === reference.bindings.join('|') };
  });
  const inSubset = rows.filter(function (row) { return row.inSubset; });
  const heap = rows.filter(function (row) {
    return !row.inSubset && row.why.indexOf('has no numeric encoding') !== -1;
  });

  assert.strictEqual(inSubset.length, 8);
  assert.strictEqual(rows.length - inSubset.length, 9);
  assert.strictEqual(inSubset.filter(function (row) { return row.agrees; }).length, 8);
  assert.strictEqual(inSubset.filter(function (row) { return row.valid; }).length, 8);
  assert.strictEqual(inSubset.reduce(function (sum, row) { return sum + row.bytes; }, 0), 1177);
  assert.ok(heap.length >= 3, 'records and arrays are the commonest exclusion');

  support.quotes('targeting-webassembly',
    ['8 of 17, compiling to 1 177 bytes in total', '8 of 8, on outcome and every binding',
      '3 programs excluded for needing a heap']);
});

/* ---------------------------------------------------------------- 30.7 JIT */

function compiledFor(id) {
  return Bytecode.compile(programOf(JitTemplate.SAMPLES[id]), { mode: 'register' });
}

test('figures: the hot fixture compiles twice, both through a back edge', function () {
  const out = Jit.differential(compiledFor('hot'), { budget: 2000000,
    thresholds: { baselineAt: 20, optimiseAt: 200, osrAt: 60 } });
  const optimising = out.jit.timeline.filter(function (row) { return row.tier === 2; });

  assert.strictEqual(out.compiles, 2);
  assert.strictEqual(out.osr, 2);
  assert.strictEqual(out.fastPaths, 4);
  assert.strictEqual(out.deopts, 0);
  assert.ok(out.agree, out.why);
  assert.ok(optimising.length > 0, 'the optimising tier was reached');
  assert.strictEqual(out.jit.profile.length, 4);
  assert.ok(out.jit.profile.every(function (row) { return row.state === 'monomorphic'; }));

  support.quotes('jit-compilation',
    ['4 transitions, at dispatch 964 and dispatch 3 204', '2 of 2 — both are on-stack replacements',
      '4 sites, all 4 monomorphic on numbers', '4, and 0 of them failed during the run']);
});

test('figures: the tier transitions happen at dispatch 964 and 3 204', function () {
  const out = Jit.run(compiledFor('hot'), { budget: 2000000,
    thresholds: { baselineAt: 20, optimiseAt: 200, osrAt: 60 } });
  const points = Array.from(new Set(out.timeline.map(function (row) { return row.at; })));

  assert.deepStrictEqual(points.sort(function (a, b) { return a - b; }), [964, 3204]);
  assert.strictEqual(out.timeline.length, 4);
  assert.ok(out.profile[0].samples >= 400, 'each site was seen four hundred times');
});

test('figures: the deopt fixture deoptimises once and still agrees', function () {
  const out = Jit.differential(compiledFor('deopt'), { budget: 2000000,
    thresholds: { baselineAt: 20, optimiseAt: 200, osrAt: 60 } });

  assert.strictEqual(out.deopts, 1);
  assert.strictEqual(out.fastPaths, 3);
  assert.ok(out.agree, out.why);
  assert.ok(out.jit.deopts[0].why.indexOf('add') !== -1,
    'the guard that failed is the one on the addition');
  assert.strictEqual(out.jit.deopts[0].fn, 'plus');

  support.quotes('jit-compilation',
    ['3', '1 deoptimisation at dispatch 6 922 — the guard on add failed']);
});

test('figures: the threshold sweep runs from 96.2 per cent to nothing compiled at all',
  function () {
    const sweep = Jit.thresholdSweep(compiledFor('hot'), [5, 20, 100, 200]);
    const byThreshold = {};

    sweep.forEach(function (row) { byThreshold[row.threshold] = row; });
    assert.strictEqual(support.fixed(byThreshold[5].share * 100, 1), '96.2');
    assert.strictEqual(support.fixed(byThreshold[20].share * 100, 1), '84.9');
    assert.strictEqual(support.fixed(byThreshold[100].share * 100, 1), '25.0');
    assert.strictEqual(byThreshold[200].compiles, 0);
    assert.strictEqual(byThreshold[200].share, 0);
  });

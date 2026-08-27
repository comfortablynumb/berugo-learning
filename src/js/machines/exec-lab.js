/**
 * The execution laboratory: one program, every mode, one comparison.
 *
 * Five back ends now exist for the same IR — the reference IR interpreter,
 * the stack VM, the register VM, the JIT over either, and the WebAssembly
 * build — and the only claim worth making about a back end is that it
 * computes what the front end computed. So the differential from M29 is
 * reused verbatim rather than reimplemented: value, output, outcome and every
 * binding, with the first difference named.
 *
 * The measurement half of this file is the other discipline, and it is the
 * one that transfers. **A single timing is not a measurement.** The bench
 * below refuses to report one: it runs a warm-up phase, then a sample of
 * runs, and reports the median with the spread and the run count beside it.
 * A "naive" mode reproduces the classic mistakes — one run, warm-up counted,
 * the result discarded so the optimiser can delete the work — and prints the
 * numbers they produce, which is the only convincing argument that they are
 * mistakes.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ExecLab = api;
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const base = './berugo/';
  const Spec = pick('Spec', 'spec.js');
  const IrLower = pick('IrLower', 'ir-lower.js');
  const IrInterp = pick('IrInterp', 'ir-interp.js');
  const Interp = pick('Interp', 'interp.js');
  const Bytecode = pick('Bytecode', 'bytecode.js');
  const Vm = pick('Vm', 'vm.js');
  const Jit = pick('Jit', 'jit.js');
  const WasmEmit = pick('WasmEmit', 'wasm-emit.js');

  function pick(name, file) {
    if (berugo && berugo[name]) return berugo[name];
    return require(base + file);
  }

  /* ---------------------------------------------------------------- the modes */

  const MODES = [
    { id: 'ir', name: 'IR interpreter', about: 'the reference, and what every other mode is compared against' },
    { id: 'stack', name: 'stack VM', about: 'small instructions, many dispatches' },
    { id: 'register', name: 'register VM', about: 'larger instructions, fewer dispatches' },
    { id: 'jit', name: 'JIT over the register VM', about: 'tiered, profiled and speculative' },
    { id: 'wasm', name: 'WebAssembly', about: 'compiled to bytes the browser runs itself' }
  ];

  function compileFor(source, mode) {
    const built = IrLower.compile(source);

    if (built.errors.length) return { errors: built.errors, program: built.program };
    if (mode === 'ir' || mode === 'wasm') return { program: built.program, errors: [] };
    const set = mode === 'stack' ? 'stack' : 'register';

    return { program: built.program, errors: [],
      compiled: Bytecode.compile(built.program, { mode: set }) };
  }

  /**
   * Every mode returns the same observable shape, so one comparison serves
   * all of them. `unsupported` is a distinct outcome from a failure: the wasm
   * back end handles a numeric subset, and a program outside it has not
   * disagreed with anything.
   */
  function runMode(source, mode, options) {
    const settings = options || {};
    const built = compileFor(source, mode);

    if (built.errors.length) {
      return { mode: mode, outcome: 'compile', ok: false, value: '', output: [],
        bindings: [], error: built.errors[0].message };
    }
    if (mode === 'ir') return tag(mode, IrInterp.run(built.program, settings));
    if (mode === 'wasm') return tag(mode, runWasm(built.program));
    if (mode === 'jit') return tag(mode, Jit.run(built.compiled, settings));
    return tag(mode, Vm.run(built.compiled, settings));
  }

  function tag(mode, result) {
    return Object.assign({ mode: mode }, result);
  }

  function runWasm(program) {
    const reasons = WasmEmit.applicable(program);

    if (!reasons.ok) {
      return { ok: false, outcome: 'unsupported', value: '', output: [], bindings: [],
        error: reasons.reasons[0].why, reasons: reasons.reasons };
    }
    return WasmEmit.run(program);
  }

  /* ------------------------------------------------------------ the comparison */

  function compare(source, options) {
    const settings = options || {};
    const reference = runMode(source, 'ir', settings);
    const rows = MODES.slice(1).map(function (mode) {
      const out = runMode(source, mode.id, settings);

      if (out.outcome === 'unsupported') {
        return { mode: mode.id, name: mode.name, outcome: 'unsupported',
          agree: null, why: out.error, dispatches: 0 };
      }
      const verdict = IrInterp.compare(reference, out);

      return { mode: mode.id, name: mode.name, outcome: out.outcome,
        agree: verdict.agree, why: verdict.agree ? '' : verdict.why,
        dispatches: out.dispatches || 0, deopts: (out.deopts || []).length,
        bytes: out.bytes || 0 };
    });

    return { reference: reference, rows: rows,
      agreed: rows.filter(function (row) { return row.agree === true; }).length,
      applicable: rows.filter(function (row) { return row.agree !== null; }).length,
      disagreed: rows.filter(function (row) { return row.agree === false; }).length };
  }

  /** The whole conformance suite through every mode, as one table. */
  function suite(options) {
    const rows = Spec.CONFORMANCE.map(function (entry) {
      const out = compare(entry.source, options);

      return { id: entry.id, agreed: out.agreed, applicable: out.applicable,
        disagreed: out.disagreed,
        modes: out.rows.reduce(function (into, row) {
          into[row.mode] = row.agree === null ? 'n/a' : (row.agree ? 'yes' : 'NO');
          return into;
        }, {}),
        why: out.rows.filter(function (row) { return row.agree === false; })
          .map(function (row) { return row.mode + ': ' + row.why; }).join('; ') };
    });

    return { rows: rows, programs: rows.length,
      disagreements: rows.reduce(function (sum, row) { return sum + row.disagreed; }, 0),
      checks: rows.reduce(function (sum, row) { return sum + row.applicable; }, 0),
      unsupported: rows.reduce(function (sum, row) {
        return sum + (MODES.length - 1 - row.applicable);
      }, 0) };
  }

  /* ---------------------------------------------------------- the benchmarks */

  const BENCHMARKS = [
    { id: 'loop', about: 'a counted loop doing arithmetic',
      source: 'let t = 0;\nlet i = 0;\nwhile i < 300 { t = t + i * 2; i = i + 1; }' },
    { id: 'calls', about: 'a function called in a loop',
      source: 'fn step(a, b) { return a + b * 2; }\nlet t = 0;\nlet i = 0;\n'
        + 'while i < 200 { t = step(t, i); i = i + 1; }' },
    { id: 'branchy', about: 'a loop whose branch goes both ways',
      source: 'let t = 0;\nlet i = 0;\nwhile i < 300 {\n'
        + '  if i < 150 { t = t + i; } else { t = t - 1; };\n  i = i + 1;\n}' },
    { id: 'nested', about: 'two nested loops',
      source: 'let t = 0;\nlet a = 0;\nwhile a < 20 {\n  let b = 0;\n'
        + '  while b < 20 { t = t + a * b; b = b + 1; }\n  a = a + 1;\n}' }
  ];

  /**
   * The protocol. Warm-up runs are executed and DISCARDED; the sample is the
   * runs after them; the reported figure is the median with the spread, and
   * the run count travels with it. Every one of those is a rule somebody
   * broke to produce a published benchmark that measured nothing.
   */
  function bench(source, mode, options) {
    const settings = options || {};
    const warmup = settings.warmup === undefined ? 3 : settings.warmup;
    const runs = settings.runs === undefined ? 7 : settings.runs;
    const samples = [];

    for (let at = 0; at < warmup; at += 1) runMode(source, mode, settings);
    for (let at = 0; at < runs; at += 1) samples.push(timeOne(source, mode, settings));
    return summarise(mode, samples, warmup, runs);
  }

  function timeOne(source, mode, settings) {
    const started = clock();
    const out = runMode(source, mode, settings);
    const took = clock() - started;

    return { ms: took, dispatches: out.dispatches || 0, outcome: out.outcome,
      /* The result is kept and reported, so nothing here can be deleted for
         being unused — the microbenchmark pathology the section is about. */
      value: out.bindings.join(', ').length };
  }

  function clock() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }

  function summarise(mode, samples, warmup, runs) {
    const times = samples.map(function (row) { return row.ms; }).sort(function (a, b) {
      return a - b;
    });

    return { mode: mode, runs: runs, warmup: warmup,
      median: times[Math.floor(times.length / 2)],
      best: times[0], worst: times[times.length - 1],
      spread: times[times.length - 1] - times[0],
      dispatches: samples[0].dispatches, outcome: samples[0].outcome,
      checksum: samples[0].value };
  }

  /**
   * The same benchmark measured the way people actually do it: one run, no
   * warm-up separated, and the result thrown away. Reporting the two side by
   * side is the argument — the naive figure is a different number, and on a
   * tiered runtime it is mostly the compilation it never let finish.
   */
  function naiveBench(source, mode, options) {
    const settings = options || {};
    const started = clock();

    runMode(source, mode, settings);
    return { mode: mode, runs: 1, warmup: 0, median: clock() - started,
      best: null, worst: null, spread: null, naive: true };
  }

  function bakeOff(options) {
    const settings = options || {};
    const modes = (settings.modes || ['ir', 'stack', 'register', 'jit']);

    return BENCHMARKS.map(function (entry) {
      return { id: entry.id, about: entry.about,
        rows: modes.map(function (mode) {
          return Object.assign({ benchmark: entry.id },
            bench(entry.source, mode, settings));
        }),
        naive: modes.map(function (mode) {
          return Object.assign({ benchmark: entry.id },
            naiveBench(entry.source, mode, settings));
        }) };
    });
  }

  /**
   * Dispatch counts rather than wall-clock, which is the honest comparison on
   * a platform whose timer resolution and JIT are outside this program's
   * control. A dispatch is a real unit of interpreter work and it is
   * deterministic, so the ratios below are reproducible in a way a
   * millisecond figure on somebody else's laptop is not.
   */
  function dispatchTable(options) {
    return BENCHMARKS.map(function (entry) {
      const rows = ['stack', 'register', 'jit'].map(function (mode) {
        const out = runMode(entry.source, mode, options || { budget: 4000000 });

        return { mode: mode, dispatches: out.dispatches || 0,
          compiled: out.compiledDispatches || 0,
          share: out.dispatches ? (out.compiledDispatches || 0) / out.dispatches : 0 };
      });

      return { id: entry.id, rows: rows,
        ratio: rows[0].dispatches && rows[1].dispatches
          ? rows[0].dispatches / rows[1].dispatches : 0 };
    });
  }

  /**
   * How the measurement moves as the input grows. A benchmark whose cost is
   * flat in its input is measuring the harness, and that is the single most
   * common way a microbenchmark lies — so the lab reports the slope rather
   * than asking anybody to trust it.
   */
  function scaling(sizes, options) {
    return sizes.map(function (size) {
      const source = 'let t = 0;\nlet i = 0;\nwhile i < ' + size
        + ' { t = t + i * 2; i = i + 1; }';
      const out = runMode(source, 'register', options || { budget: 8000000 });

      return { size: size, dispatches: out.dispatches,
        perItem: Number((out.dispatches / size).toFixed(2)) };
    });
  }

  return {
    MODES: MODES, BENCHMARKS: BENCHMARKS,
    compileFor: compileFor, runMode: runMode, compare: compare, suite: suite,
    bench: bench, naiveBench: naiveBench, bakeOff: bakeOff,
    dispatchTable: dispatchTable, scaling: scaling
  };
}));

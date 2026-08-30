/**
 * OooTrace - the dynamic instruction trace, which is the thing a dependence
 * analysis is actually about.
 *
 * A dependence graph drawn over the *static* program is a graph of what might
 * happen. The one that decides how fast a program can run is drawn over what
 * did happen: a loop executed forty times contributes forty nodes, and the
 * chain through its induction variable is forty long. Analysing the source and
 * analysing the run give different answers, and only one of them is a bound on
 * the machine.
 *
 * So the trace comes from the M34 behavioural simulator, executed in order,
 * one row per retired instruction, with the memory address it touched
 * recorded. That last part matters more than it looks: whether two memory
 * accesses are dependent is not knowable from the instruction text - it is a
 * property of the addresses, and the addresses are only known at run time.
 * That is the whole reason memory dependence speculation exists.
 *
 * The trace deliberately says nothing about cycles, ports or windows. It is
 * the program's own structure, and `algorithms/ilp-analysis.js` turns it into
 * a bound that no microarchitecture can beat.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Ooo = scope.Ooo || {};
    scope.Ooo.Trace = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Reference = has && root.Brv32.Reference ? root.Brv32.Reference
    : require('../brv32/reference-sim.js');
  const Assembler = has && root.Brv32.Assembler ? root.Brv32.Assembler
    : require('../brv32/assembler.js');
  const Scheduler = root && root.Ooo && root.Ooo.Scheduler ? root.Ooo.Scheduler
    : require('./scheduler.js');

  /** Read lazily, because `ooo-core.js` loads after this file does and reading
   *  it at factory time would capture undefined and fail in the browser only. */
  function core() {
    return root && root.OooCore ? root.OooCore : require('../ooo-core.js');
  }

  /**
   * Run a program and record one row per retired instruction.
   *
   * The trap that ends every sample program is not a row: it retires nothing
   * and its only effect is to stop the machine, so counting it would inflate
   * the instruction count that every ratio here divides by.
   */
  function of(options) {
    const settings = options || {};
    const machine = Reference.create({ image: settings.image, entry: settings.entry || 0,
      stack: settings.stack });
    const limit = settings.limit || 4000;
    const rows = [];

    while (rows.length < limit) {
      const pc = machine.pc >>> 0;
      const out = Reference.step(machine);

      if (!out.ok || out.trapped) return { rows: rows, stopped: stopReason(out) };
      rows.push(row(rows.length, pc, out));
    }
    return { rows: rows, stopped: 'the trace limit of ' + limit + ' instructions' };
  }

  function stopReason(out) {
    if (out && out.trapped) return 'a trap: ' + out.cause.name;
    return 'the machine stopped';
  }

  function row(id, pc, out) {
    const decoded = out.decoded;
    const reads = core().readsRegisters(decoded);
    const kind = core().kindOf(decoded);

    return { id: id, pc: pc, name: decoded.name, kind: kind,
      latency: Scheduler.LATENCY[kind] || 1,
      reads: sources(decoded, reads), writes: destination(decoded),
      address: out.access ? out.access.address >>> 0 : null,
      access: out.access ? out.access.kind : null };
  }

  /** x0 is a name that always reads zero and can never be a dependence, so it
   *  is left out rather than special-cased in four later places. */
  function sources(decoded, reads) {
    const out = [];

    if (reads.rs1 && decoded.rs1 !== 0) out.push(decoded.rs1);
    if (reads.rs2 && decoded.rs2 !== 0) out.push(decoded.rs2);
    return out;
  }

  function destination(decoded) {
    return core().writesRegister(decoded) ? decoded.rd : null;
  }

  /** Assemble a source string and trace it in one step, which is what every
   *  caller in the sections actually wants. */
  function ofSource(source, options) {
    const settings = options || {};
    const image = Assembler.assemble(source, { origin: 0 });

    return of(Object.assign({ image: image.bytes, entry: 0 }, settings));
  }

  function summary(trace) {
    const kinds = {};

    trace.rows.forEach(function (entry) {
      kinds[entry.kind] = (kinds[entry.kind] || 0) + 1;
    });
    return { instructions: trace.rows.length, kinds: kinds,
      memory: trace.rows.filter(function (entry) { return entry.address !== null; }).length,
      stopped: trace.stopped };
  }

  return { of: of, ofSource: ofSource, summary: summary };
}));

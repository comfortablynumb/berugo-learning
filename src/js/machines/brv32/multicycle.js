/**
 * Brv32Multicycle - the same instruction set, spread over several cycles.
 *
 * A single-cycle machine charges every instruction the delay of the slowest
 * path in the whole datapath. A multi-cycle machine cuts that path into stages
 * with a register between them, so the clock period is the longest STAGE, and
 * each instruction takes as many cycles as it has stages. Whether that is a
 * win is arithmetic, not opinion:
 *
 *     time = instructions x cycles-per-instruction x clock period
 *
 * and it is entirely possible to lower the period and lose. This module
 * measures both machines rather than assuming: the stage delays come from
 * building each stage as a netlist and walking it, and the instruction mix
 * comes from actually running the program.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Multicycle = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Sim = root && root.LogicSim ? root.LogicSim : require('../logic-sim.js');
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Datapath = has && root.Brv32.Datapath ? root.Brv32.Datapath : require('./datapath.js');
  const Reference = has && root.Brv32.Reference ? root.Brv32.Reference
    : require('./reference-sim.js');
  const Timing = root && root.Timing ? root.Timing : require('../timing.js');

  /** The five classical stages. Every instruction visits fetch and decode;
   *  after that it depends on what it is, which is where CPI comes from. */
  const STAGES = [
    { name: 'fetch', about: 'read the instruction at the program counter' },
    { name: 'decode', about: 'decode it and read the source registers' },
    { name: 'execute', about: 'the ALU: arithmetic, an address, or a comparison' },
    { name: 'memory', about: 'the data access — only loads and stores come here' },
    { name: 'writeback', about: 'put the result in the destination register' }
  ];

  /** Which stages each instruction class needs. A store computes an address
   *  and writes memory but has nothing to write back; a branch decides in the
   *  execute stage and is finished. */
  const CLASSES = {
    arithmetic: { stages: ['fetch', 'decode', 'execute', 'writeback'], cycles: 4 },
    load: { stages: ['fetch', 'decode', 'execute', 'memory', 'writeback'], cycles: 5 },
    store: { stages: ['fetch', 'decode', 'execute', 'memory'], cycles: 4 },
    branch: { stages: ['fetch', 'decode', 'execute'], cycles: 3 },
    jump: { stages: ['fetch', 'decode', 'execute', 'writeback'], cycles: 4 },
    system: { stages: ['fetch', 'decode'], cycles: 2 }
  };

  function classOf(name) {
    const row = Isa.BY_NAME[name];

    if (!row) return 'system';
    if (row.opcode === Isa.OPCODES.load) return 'load';
    if (row.opcode === Isa.OPCODES.store) return 'store';
    if (row.opcode === Isa.OPCODES.branch) return 'branch';
    if (row.opcode === Isa.OPCODES.jal || row.opcode === Isa.OPCODES.jalr) return 'jump';
    if (row.opcode === Isa.OPCODES.system) return 'system';
    return 'arithmetic';
  }

  /* ---------------------------------------------------- measuring stages */

  function registerStage() {
    const net = Sim.create('register file stage');
    const clock = Sim.addInput(net, 'clk');
    const ports = { rd: Datapath.inputBus(net, 'rd', 5),
      rs1: Datapath.inputBus(net, 'rs1', 5), rs2: Datapath.inputBus(net, 'rs2', 5),
      regWrite: Sim.addInput(net, 'we'), clock: clock, pending: [] };
    const files = Datapath.registerFile(net, ports);

    Datapath.outputBus(net, 'a', files.readA);
    return net;
  }

  function executeStage() {
    const net = Sim.create('execute stage');
    const a = Datapath.inputBus(net, 'a', 32);
    const b = Datapath.inputBus(net, 'b', 32);
    const control = { sub: Sim.addInput(net, 'sub'), arith: Sim.addInput(net, 'arith'),
      unsig: Sim.addInput(net, 'unsig'), select: Datapath.inputBus(net, 'sel', 3) };

    Datapath.outputBus(net, 'y', Datapath.alu(net, a, b, control).out);
    return net;
  }

  function addressStage() {
    const net = Sim.create('program counter stage');
    const pc = Datapath.inputBus(net, 'p', 32);
    const offset = Datapath.inputBus(net, 'i', 32);

    Datapath.outputBus(net, 's',
      Datapath.addBus(net, pc, offset, Sim.addNode(net, 'const0', [])).sums);
    return net;
  }

  /** Each stage built alone and walked. Doing it this way rather than
   *  estimating is the difference between "the ALU is probably the slow one"
   *  and knowing that it holds most of the period. */
  function stageDelays() {
    const built = [
      { name: 'decode', net: registerStage() },
      { name: 'execute', net: executeStage() },
      { name: 'address', net: addressStage() }
    ];

    return built.map(function (row) {
      return { name: row.name, gates: Sim.gateCount(row.net),
        delay: Sim.criticalPath(row.net).delay };
    });
  }

  /* ------------------------------------------------------- the comparison */

  function mixOf(image, options) {
    const settings = options || {};
    const machine = Reference.create({ image: image, entry: settings.entry || 0 });
    const counts = {};
    let retired = 0;

    for (let at = 0; at < (settings.budget || 400); at += 1) {
      const decoded = Isa.decode(Reference.fetch(machine).word || 0);
      const out = Reference.step(machine);

      if (decoded.ok) {
        const kind = classOf(decoded.name);

        counts[kind] = (counts[kind] || 0) + 1;
        retired += 1;
      }
      if (out.trapped) break;
    }
    return { counts: counts, retired: retired };
  }

  /**
   * Both machines on the same program. `singlePeriod` is the whole datapath's
   * register-to-register path; `multiPeriod` is the longest stage plus the
   * same flip-flop overhead, paid once per cycle rather than once per
   * instruction.
   */
  function compare(image, options) {
    const settings = options || {};
    const stages = settings.stages || stageDelays();
    const overhead = Timing.DEFAULTS.clockToQ + Timing.DEFAULTS.setup;
    const slowest = stages.reduce(function (best, row) {
      return row.delay > best ? row.delay : best;
    }, 0);
    const mix = mixOf(image, settings);
    const cpi = cpiFor(mix.counts);

    const single = { period: settings.singlePeriod || 0, cycles: mix.retired };
    const multi = { period: slowest + overhead, cycles: Math.round(cpi * mix.retired) };

    return { stages: stages, mix: mix, cpi: cpi, overhead: overhead,
      single: single, multi: multi, slowest: slowest,
      /* The period the multi-cycle machine would need to break even. Naming
         it turns "multi-cycle loses here" into a number somebody can aim at,
         and it is usually the more useful half of a negative result. */
      breakEven: multi.cycles ? Math.floor(timeOf(single) / multi.cycles) : 0 };
  }

  function cpiFor(counts) {
    const total = Object.keys(counts).reduce(function (sum, kind) {
      return sum + counts[kind];
    }, 0);

    if (!total) return 0;
    return Object.keys(counts).reduce(function (sum, kind) {
      return sum + counts[kind] * CLASSES[kind].cycles;
    }, 0) / total;
  }

  /** Total time in gate delays, which is the only unit both machines share. */
  function timeOf(row) {
    return row.cycles * row.period;
  }

  /** The control FSM, as data for the diagram: which stage follows which, and
   *  where an instruction class leaves the loop. */
  function fsm() {
    return Object.keys(CLASSES).map(function (kind) {
      return { kind: kind, stages: CLASSES[kind].stages, cycles: CLASSES[kind].cycles };
    });
  }

  return { STAGES: STAGES, CLASSES: CLASSES, classOf: classOf, stageDelays: stageDelays,
    compare: compare, cpiFor: cpiFor, timeOf: timeOf, mixOf: mixOf, fsm: fsm,
    registerStage: registerStage, executeStage: executeStage, addressStage: addressStage };
}));

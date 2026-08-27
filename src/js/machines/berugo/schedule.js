/**
 * Instruction scheduling: a dependence DAG, list scheduling, and the register
 * pressure it costs.
 *
 * The two passes in this file fight, and that is the section. Scheduling
 * moves an instruction away from the one that produced its operand so the
 * result has time to arrive; doing that keeps the value live longer, which
 * raises register pressure, which makes M30.4 spill. A spill is a memory
 * access, so an aggressive schedule can cost more than the stalls it removed
 * — which is why the order of these two passes is tuned per target rather
 * than settled once.
 *
 * The pipeline model is deliberately simple and stated: one instruction
 * issued per cycle, in order, and a consumer stalls until its producer's
 * latency has elapsed. That is not a real machine and is enough to make the
 * trade visible; M35 has the real pipeline, and the latencies here are the
 * ones it uses so the two sections agree.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Schedule = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');

  /**
   * Cycles between issuing an instruction and its result being readable. A
   * load is the expensive one, which is why every scheduler in every compiler
   * is mostly a load scheduler.
   */
  const LATENCY = {
    const: 1, move: 1, unary: 1, binary: 2, phi: 1,
    loadLocal: 3, storeLocal: 1, loadField: 4, storeField: 1,
    loadIndex: 4, storeIndex: 1,
    makeArray: 3, makeRecord: 3, makeClosure: 3, call: 8,
    jump: 1, branch: 1, ret: 1
  };

  function latencyOf(inst, overrides) {
    const table = overrides || {};

    if (inst.op === 'binary' && (inst.operator === 'div' || inst.operator === 'rem')) {
      return table.divide === undefined ? 12 : table.divide;
    }
    return table[inst.op] === undefined ? (LATENCY[inst.op] || 1) : table[inst.op];
  }

  /* ------------------------------------------------------- the dependence DAG */

  /**
   * Three kinds of edge, and the second two are why a scheduler cannot simply
   * follow the values. **True** — a consumer must come after its producer.
   * **Memory** — a load must not move above a store, and a store must not move
   * above either, because the alias analysis of M29.9 is what would be needed
   * to prove otherwise and it is not consulted here. **Effect** — a call may
   * do anything, so nothing with a side effect crosses one.
   */
  const MEMORY_READ = ['loadField', 'loadIndex', 'loadLocal'];
  const MEMORY_WRITE = ['storeField', 'storeIndex', 'storeLocal'];
  const EFFECTFUL = ['call'];

  function dagOf(block, options) {
    const settings = options || {};
    const nodes = block.instructions.map(function (inst, at) {
      return { at: at, inst: inst, op: inst.op, target: Ir.definitionOf(inst),
        latency: latencyOf(inst, settings.latency), preds: [], succs: [] };
    });

    addTrueEdges(nodes);
    addOrderingEdges(nodes);
    return { nodes: nodes, block: block.id, edges: countEdges(nodes) };
  }

  function link(from, to) {
    if (from.succs.indexOf(to) !== -1) return;
    from.succs.push(to);
    to.preds.push(from);
  }

  function addTrueEdges(nodes) {
    const producer = {};

    nodes.forEach(function (node) {
      Ir.usesOf(node.inst).forEach(function (register) {
        if (producer[register]) link(producer[register], node);
      });
      if (node.target) producer[node.target] = node;
    });
  }

  function addOrderingEdges(nodes) {
    let lastWrite = null;
    let lastEffect = null;
    const readsSince = [];

    nodes.forEach(function (node) {
      const reads = MEMORY_READ.indexOf(node.op) !== -1;
      const writes = MEMORY_WRITE.indexOf(node.op) !== -1;
      const effect = EFFECTFUL.indexOf(node.op) !== -1;

      if (lastEffect && (reads || writes || effect)) link(lastEffect, node);
      if (reads && lastWrite) link(lastWrite, node);
      if (writes || effect) {
        if (lastWrite) link(lastWrite, node);
        readsSince.forEach(function (read) { link(read, node); });
        readsSince.length = 0;
        lastWrite = node;
      }
      if (effect) lastEffect = node;
      if (reads) readsSince.push(node);
    });
  }

  function countEdges(nodes) {
    return nodes.reduce(function (sum, node) { return sum + node.succs.length; }, 0);
  }

  /* --------------------------------------------------------- the critical path */

  /**
   * The longest latency-weighted path from a node to any exit of the DAG.
   * List scheduling picks the ready instruction with the largest one, which
   * is the standard priority and the reason the schedule is good rather than
   * merely legal — an instruction on the critical path delays everything
   * behind it, so it goes first.
   */
  function criticalPaths(dag) {
    const height = new Array(dag.nodes.length).fill(0);

    dag.nodes.slice().reverse().forEach(function (node) {
      height[node.at] = node.latency + node.succs.reduce(function (most, next) {
        return Math.max(most, height[next.at]);
      }, 0);
    });
    return height;
  }

  /* ---------------------------------------------------------- list scheduling */

  function listSchedule(block, options) {
    const settings = options || {};
    const dag = dagOf(block, settings);
    const height = criticalPaths(dag);
    const state = { ready: [], done: new Set(), out: [], remaining: dag.nodes.length,
      readyAt: new Array(dag.nodes.length).fill(0), cycle: 0 };

    dag.nodes.forEach(function (node) { if (!node.preds.length) state.ready.push(node); });
    while (state.remaining > 0) {
      if (!state.ready.length) { state.cycle += 1; refill(dag, state); continue; }
      issue(state, chooseReady(state, height, settings), height);
      refill(dag, state);
    }
    return { order: state.out.map(function (node) { return node.at; }), dag: dag,
      height: height, cycles: state.cycle };
  }

  function chooseReady(state, height, settings) {
    const runnable = state.ready.filter(function (node) {
      return state.readyAt[node.at] <= state.cycle;
    });
    const pool = runnable.length ? runnable : state.ready;

    if (settings.priority === 'source') {
      return pool.reduce(function (best, node) { return node.at < best.at ? node : best; });
    }
    return pool.reduce(function (best, node) {
      return height[node.at] > height[best.at] ? node : best;
    });
  }

  function issue(state, node, height) {
    state.ready.splice(state.ready.indexOf(node), 1);
    state.out.push(node);
    state.done.add(node.at);
    state.remaining -= 1;
    state.cycle = Math.max(state.cycle, state.readyAt[node.at]) + 1;
    node.succs.forEach(function (next) {
      state.readyAt[next.at] = Math.max(state.readyAt[next.at],
        state.cycle - 1 + node.latency);
    });
    return height;
  }

  function refill(dag, state) {
    dag.nodes.forEach(function (node) {
      if (state.done.has(node.at) || state.ready.indexOf(node) !== -1) return;
      if (node.preds.every(function (pred) { return state.done.has(pred.at); })) {
        state.ready.push(node);
      }
    });
  }

  /* ------------------------------------------------------- the pipeline model */

  /**
   * One instruction per cycle, in order, and a consumer waits for its
   * producer's latency. The stall count is the whole output: it is what the
   * schedule is trying to remove, and reporting cycles without it hides
   * whether a shorter run is fewer instructions or fewer waits.
   */
  function simulate(block, order, options) {
    const settings = options || {};
    const dag = dagOf(block, settings);
    const ready = {};
    const state = { cycle: 0, stalls: 0, timeline: [] };

    order.forEach(function (at) {
      const node = dag.nodes[at];
      const earliest = node.preds.reduce(function (soonest, pred) {
        return Math.max(soonest, ready[pred.at] === undefined ? 0 : ready[pred.at]);
      }, state.cycle);

      state.stalls += earliest - state.cycle;
      state.timeline.push({ at: at, op: node.op, issued: earliest,
        waited: earliest - state.cycle });
      state.cycle = earliest + 1;
      ready[at] = earliest + node.latency;
    });
    return { cycles: state.cycle, stalls: state.stalls, timeline: state.timeline,
      instructions: order.length };
  }

  /* ------------------------------------------------------- register pressure */

  /**
   * How many values are live at each point of a given order. The maximum is
   * what the allocator is handed, and it is the cost side of the schedule —
   * a shorter run of cycles bought with a higher peak may spill, and a spill
   * is a memory access the schedule cannot hide.
   */
  function pressure(block, order) {
    const lastUse = lastUses(block, order);
    const live = new Set();
    const rows = [];

    order.forEach(function (at, step) {
      const inst = block.instructions[at];

      Ir.usesOf(inst).forEach(function (register) {
        if (Ir.isRegister(register) && lastUse[register] === step) live.delete(register);
      });
      const target = Ir.definitionOf(inst);

      if (target) live.add(target);
      rows.push({ step: step, at: at, live: live.size });
    });
    return { rows: rows, peak: rows.reduce(function (most, row) {
      return Math.max(most, row.live);
    }, 0) };
  }

  function lastUses(block, order) {
    const last = {};

    order.forEach(function (at, step) {
      Ir.usesOf(block.instructions[at]).forEach(function (register) {
        last[register] = step;
      });
    });
    return last;
  }

  /* ------------------------------------------------------------ verification */

  /**
   * A schedule is legal exactly when every DAG edge still points forwards.
   * Checking that rather than trusting the algorithm is the difference
   * between a scheduler and a shuffler, and it is one loop.
   */
  function legal(block, order, options) {
    const dag = dagOf(block, options);
    const position = {};
    const violations = [];

    order.forEach(function (at, step) { position[at] = step; });
    dag.nodes.forEach(function (node) {
      node.succs.forEach(function (next) {
        if (position[node.at] >= position[next.at]) {
          violations.push({ from: node.at, to: next.at, op: node.op });
        }
      });
    });
    return { ok: violations.length === 0, violations: violations,
      scheduled: order.length, instructions: block.instructions.length };
  }

  /* --------------------------------------------------------------- reporting */

  function compareBlock(block, options) {
    const settings = options || {};
    const source = block.instructions.map(function (inst, at) { return at; });
    const scheduled = listSchedule(block, settings).order;

    return { block: block.id, instructions: source.length,
      rows: [{ name: 'source order', order: source },
        { name: 'list scheduled', order: scheduled }].map(function (row) {
        const run = simulate(block, row.order, settings);

        return { name: row.name, cycles: run.cycles, stalls: run.stalls,
          peak: pressure(block, row.order).peak, legal: legal(block, row.order, settings).ok };
      }) };
  }

  function report(fn, options) {
    const rows = fn.blocks.filter(function (block) {
      return block.instructions.length > 1;
    }).map(function (block) { return compareBlock(block, options); });

    return { rows: rows,
      before: rows.reduce(function (sum, row) { return sum + row.rows[0].cycles; }, 0),
      after: rows.reduce(function (sum, row) { return sum + row.rows[1].cycles; }, 0),
      stallsBefore: rows.reduce(function (sum, row) { return sum + row.rows[0].stalls; }, 0),
      stallsAfter: rows.reduce(function (sum, row) { return sum + row.rows[1].stalls; }, 0),
      peakBefore: rows.reduce(function (most, row) {
        return Math.max(most, row.rows[0].peak);
      }, 0),
      peakAfter: rows.reduce(function (most, row) {
        return Math.max(most, row.rows[1].peak);
      }, 0),
      illegal: rows.filter(function (row) { return !row.rows[1].legal; }).length };
  }

  /** The trade, as one table: latency up, stalls removed, pressure paid. */
  function latencySweep(fn, values) {
    return values.map(function (value) {
      const out = report(fn, { latency: { loadIndex: value, loadField: value } });

      return { latency: value, cycles: out.after, saved: out.before - out.after,
        stalls: out.stallsAfter, peak: out.peakAfter, peakBefore: out.peakBefore };
    });
  }

  return {
    LATENCY: LATENCY, latencyOf: latencyOf,
    dagOf: dagOf, criticalPaths: criticalPaths,
    listSchedule: listSchedule, simulate: simulate, pressure: pressure, legal: legal,
    compareBlock: compareBlock, report: report, latencySweep: latencySweep
  };
}));

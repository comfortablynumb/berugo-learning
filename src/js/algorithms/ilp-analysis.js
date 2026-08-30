/**
 * IlpAnalysis - the dependence graph of a trace, its critical path, and the
 * instruction-level parallelism that follows from them.
 *
 * The point of this file is that it knows nothing about the processor. It is
 * given a list of instructions with the registers each read and wrote and the
 * address each touched, and it computes how long the program would take on a
 * machine with unlimited resources: infinite width, infinite window, perfect
 * prediction, one cycle per operation. That number is a property of the code,
 * and no microarchitecture can beat it.
 *
 * Which is the reason the file exists. Every measurement in this milestone is
 * a claim about a simulator, and a simulator that reports an IPC higher than
 * the code's own dependence structure allows is broken in a way that no
 * differential against an in-order reference can detect - both machines would
 * still compute the right answer. The bound is the independent oracle for the
 * timing, and the tests assert the measured IPC never exceeds it.
 *
 * Three dependence kinds, and only one of them is real:
 *
 *   - read after write is a dependence on a VALUE. It cannot be removed by any
 *     amount of hardware, and the longest chain of them is the critical path.
 *   - write after read and write after write are dependences on a NAME. They
 *     exist because the instruction set has thirty-two registers, and renaming
 *     removes them outright (`machines/ooo/rename.js`).
 *
 * Running the same trace with and without the name dependences is what puts a
 * number on renaming, and the number is large on exactly the code that looks
 * parallel to a reader and is not parallel to an unrenamed machine.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.IlpAnalysis = api;
}(this, function () {
  'use strict';

  /**
   * Which dependence kinds a machine has to obey.
   *
   * `renamed` is a modern core: values and real memory dependences only.
   * `unrenamed` adds the two name dependences, which is what a machine with
   * thirty-two architectural registers and no physical file must respect.
   * `conservative` keeps renaming but makes every load wait for every older
   * store, which is what a machine without memory disambiguation must do.
   */
  const MODELS = {
    renamed: { kinds: ['raw', 'mem'],
      about: 'values and real memory dependences only - a machine that renames' },
    unrenamed: { kinds: ['raw', 'war', 'waw', 'mem'],
      about: 'plus the two dependences that are about register names' },
    conservative: { kinds: ['raw', 'mem', 'memOrder'],
      about: 'renamed, but every load waits for every older store' }
  };

  function latencyOf(row, options) {
    if (options && options.unitLatency) return 1;
    return Math.max(1, row.latency || 1);
  }

  /* ------------------------------------------------------------- the graph */

  /**
   * Build the dependence graph. Every edge runs from a lower id to a higher
   * one, because the trace is in program order - which is what lets the
   * critical path be one forward pass rather than a topological sort.
   */
  function build(rows, options) {
    const settings = options || {};
    const nodes = rows.map(function (row) {
      return { id: row.id, pc: row.pc, name: row.name, kind: row.kind,
        latency: latencyOf(row, settings), reads: row.reads || [],
        writes: row.writes === undefined ? null : row.writes,
        address: row.address === undefined ? null : row.address,
        access: row.access || null };
    });
    const edges = registerEdges(nodes).concat(memoryEdges(nodes));

    return { nodes: nodes, edges: edges, model: settings.model || 'renamed' };
  }

  /** One pass, remembering the last writer and the readers since it - which is
   *  all three register dependence kinds at once. */
  function registerEdges(nodes) {
    const lastWrite = {};
    const readers = {};
    const edges = [];

    nodes.forEach(function (node) {
      node.reads.forEach(function (reg) {
        if (lastWrite[reg] !== undefined) {
          edges.push({ from: lastWrite[reg], to: node.id, kind: 'raw', through: 'x' + reg });
        }
        readers[reg] = (readers[reg] || []).concat([node.id]);
      });
      if (node.writes === null) return;
      pushNameEdges(edges, node, lastWrite, readers);
      lastWrite[node.writes] = node.id;
      readers[node.writes] = [];
    });
    return edges;
  }

  function pushNameEdges(edges, node, lastWrite, readers) {
    const reg = node.writes;

    if (lastWrite[reg] !== undefined) {
      edges.push({ from: lastWrite[reg], to: node.id, kind: 'waw', through: 'x' + reg });
    }
    (readers[reg] || []).forEach(function (id) {
      if (id === node.id) return;
      edges.push({ from: id, to: node.id, kind: 'war', through: 'x' + reg });
    });
  }

  /**
   * Memory dependences, which are the ones that cannot be read off the
   * instruction text.
   *
   * `mem` is a real dependence: a load reading an address an older store wrote.
   * `memOrder` is the price of not knowing - a chain through every store plus
   * an edge from the nearest older store to each load, which is the transitive
   * reduction of "every load waits for every older store" and keeps the graph
   * linear in the trace length rather than quadratic.
   */
  function memoryEdges(nodes) {
    const lastStoreTo = {};
    const edges = [];
    let lastStore = null;

    nodes.forEach(function (node) {
      if (node.address === null) return;
      if (node.access === 'read') {
        if (lastStoreTo[node.address] !== undefined) {
          edges.push({ from: lastStoreTo[node.address], to: node.id, kind: 'mem',
            through: address(node.address) });
        }
        if (lastStore !== null) {
          edges.push({ from: lastStore, to: node.id, kind: 'memOrder', through: 'any store' });
        }
        return;
      }
      if (lastStore !== null) {
        edges.push({ from: lastStore, to: node.id, kind: 'memOrder', through: 'store order' });
      }
      lastStoreTo[node.address] = node.id;
      lastStore = node.id;
    });
    return edges;
  }

  function address(value) {
    return '0x' + (value >>> 0).toString(16);
  }

  /* ------------------------------------------------------- the critical path */

  function kindsFor(model) {
    return (MODELS[model] || MODELS.renamed).kinds;
  }

  /**
   * The longest path through the graph, in cycles.
   *
   * One forward pass: an instruction can start when every instruction it
   * depends on has finished, and the answer is the latest finish. The
   * predecessor that decided each start is remembered so the path itself can
   * be shown - a critical path nobody can point at is not much use to somebody
   * trying to shorten it.
   */
  function criticalPath(graph, model) {
    const allowed = kindsFor(model || graph.model);
    const incoming = groupEdges(graph, allowed);
    const finish = {};
    const start = {};
    const came = {};
    let longest = 0;
    let last = null;

    graph.nodes.forEach(function (node) {
      const parents = incoming[node.id] || [];
      let at = 0;

      parents.forEach(function (edge) {
        if (finish[edge.from] > at) { at = finish[edge.from]; came[node.id] = edge; }
      });
      start[node.id] = at;
      finish[node.id] = at + node.latency;
      if (finish[node.id] > longest) { longest = finish[node.id]; last = node.id; }
    });
    return { length: longest, start: start, finish: finish,
      path: walkBack(graph, came, last) };
  }

  function groupEdges(graph, allowed) {
    const out = {};

    graph.edges.forEach(function (edge) {
      if (allowed.indexOf(edge.kind) === -1) return;
      out[edge.to] = (out[edge.to] || []).concat([edge]);
    });
    return out;
  }

  function walkBack(graph, came, last) {
    const byId = {};
    const path = [];
    let at = last;

    graph.nodes.forEach(function (node) { byId[node.id] = node; });
    while (at !== null && at !== undefined) {
      const edge = came[at];

      path.unshift({ id: at, name: byId[at].name, pc: byId[at].pc,
        through: edge ? edge.through : null, kind: edge ? edge.kind : null });
      at = edge ? edge.from : null;
    }
    return path;
  }

  /* ------------------------------------------------------------ the numbers */

  /**
   * The bound: instructions divided by the critical path.
   *
   * With unlimited width and window, the program takes exactly as long as its
   * longest dependence chain, so this is the highest IPC any machine could
   * report on this trace. A simulator claiming more has a bug in its timing
   * that no correctness test can see.
   */
  function analyse(rows, options) {
    const settings = options || {};
    const graph = build(rows, settings);
    const model = settings.model || 'renamed';
    const found = criticalPath(graph, model);

    return { instructions: graph.nodes.length, criticalPath: found.length,
      ilp: found.length ? graph.nodes.length / found.length : 0,
      model: model, about: (MODELS[model] || MODELS.renamed).about,
      path: found.path, graph: graph, start: found.start,
      counts: countEdges(graph) };
  }

  function countEdges(graph) {
    const out = { raw: 0, war: 0, waw: 0, mem: 0, memOrder: 0 };

    graph.edges.forEach(function (edge) { out[edge.kind] += 1; });
    return out;
  }

  /** The same trace under all three models, which is what puts a number on
   *  renaming and on memory disambiguation. */
  function compare(rows, options) {
    return Object.keys(MODELS).map(function (model) {
      const found = analyse(rows, Object.assign({}, options, { model: model }));

      return { model: model, about: found.about, criticalPath: found.criticalPath,
        ilp: found.ilp, instructions: found.instructions };
    });
  }

  /**
   * How many instructions could start in each cycle if resources were free.
   *
   * This is the picture the 1970s and 1980s ILP studies produced, and the
   * reason their results were disappointing: the profile is a few very tall
   * spikes with long flat stretches between them, so a machine wide enough for
   * the spikes is idle for most of the run.
   */
  function profile(rows, options) {
    const found = analyse(rows, options);
    const buckets = new Array(Math.max(1, found.criticalPath)).fill(0);

    found.graph.nodes.forEach(function (node) {
      const at = found.start[node.id];

      if (at < buckets.length) buckets[at] += 1;
    });
    return buckets.map(function (count, cycle) {
      return { cycle: cycle, ready: count };
    });
  }

  /** The check the tests exist for: a measured IPC above the bound is a bug in
   *  the timing model, not a fast machine. */
  function respects(bound, measured) {
    return measured <= bound + 1e-9;
  }

  return { MODELS: MODELS, build: build, criticalPath: criticalPath, analyse: analyse,
    compare: compare, profile: profile, respects: respects };
}));

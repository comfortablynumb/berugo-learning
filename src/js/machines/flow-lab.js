/**
 * FlowLab - the harness every M14 flow section drives.
 *
 * It generates networks, runs every max-flow algorithm on the same instance,
 * and reports whether they agree as a *field* rather than throwing. That
 * matters here more than anywhere else in the platform: a flow algorithm fails
 * by returning a plausible number, and the only things that separate a flow
 * from an array of integers are capacity, conservation, and the cut whose
 * capacity must equal the value.
 *
 * Every generator is deliberately a different shape. A layered network makes
 * Dinic's phase count visible; a unit-capacity network makes the path count
 * equal the flow value; a grid with two seeded terminals is an image
 * segmentation; and the bipartite generator turns matching into flow, which is
 * the reduction M14.5 is about.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FlowLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  function modules() {
    if (typeof module !== 'undefined' && module.exports) {
      return {
        MaxFlow: require('../algorithms/max-flow.js'),
        PushRelabel: require('../algorithms/push-relabel.js'),
        MinCostFlow: require('../algorithms/min-cost-flow.js'),
        Random: require('../utils/random.js')
      };
    }
    return { MaxFlow: scope.MaxFlow, PushRelabel: scope.PushRelabel,
      MinCostFlow: scope.MinCostFlow, Random: scope.Random };
  }

  const SHAPES = ['layered', 'grid', 'random', 'unit', 'bipartite', 'segmentation', 'bottleneck'];

  /* ------------------------------------------------------------ generation */

  function build(spec) {
    const settings = spec || {};
    const random = modules().Random.seeded(settings.seed === undefined ? 1 : settings.seed);

    if (settings.shape === 'grid') return gridNetwork(settings, random);

    if (settings.shape === 'unit') return unitNetwork(settings, random);

    if (settings.shape === 'bipartite') return bipartiteNetwork(settings, random);

    if (settings.shape === 'segmentation') return segmentationNetwork(settings, random);

    if (settings.shape === 'bottleneck') return bottleneckNetwork(settings);

    if (settings.shape === 'random') return randomNetwork(settings, random);
    return layeredNetwork(settings, random);
  }

  /** Source, `layers` ranks of `width`, sink. Dinic's level graph deepens by
   *  one per phase here, which makes the phase count legible. */
  function layeredNetwork(settings, random) {
    const width = settings.width || 4;
    const layers = settings.layers || 4;
    const capacity = settings.capacity || 12;
    const n = layers * width + 2;
    const source = n - 2;
    const sink = n - 1;
    const edges = [];

    for (let i = 0; i < width; i += 1) {
      edges.push({ from: source, to: i, capacity: 1 + random.int(capacity) });
      edges.push({ from: (layers - 1) * width + i, to: sink, capacity: 1 + random.int(capacity) });
    }

    for (let layer = 0; layer + 1 < layers; layer += 1) {
      for (let a = 0; a < width; a += 1) {
        for (let b = 0; b < width; b += 1) {
          if (random.int(3) === 0) continue;
          edges.push({ from: layer * width + a, to: (layer + 1) * width + b,
            capacity: 1 + random.int(capacity) });
        }
      }
    }
    return { n: n, edges: edges, source: source, sink: sink, name: 'layered' };
  }

  /** A rows x columns grid flowing left to right. */
  function gridNetwork(settings, random) {
    const rows = settings.rows || 5;
    const columns = settings.columns || 5;
    const n = rows * columns + 2;
    const source = n - 2;
    const sink = n - 1;
    const edges = [];
    const at = function (r, c) { return r * columns + c; };

    for (let r = 0; r < rows; r += 1) {
      edges.push({ from: source, to: at(r, 0), capacity: 1 + random.int(9) });
      edges.push({ from: at(r, columns - 1), to: sink, capacity: 1 + random.int(9) });

      for (let c = 0; c + 1 < columns; c += 1) {
        edges.push({ from: at(r, c), to: at(r, c + 1), capacity: 1 + random.int(9) });

        if (r + 1 >= rows) continue;
        edges.push({ from: at(r, c), to: at(r + 1, c), capacity: 1 + random.int(9) });
        edges.push({ from: at(r + 1, c), to: at(r, c), capacity: 1 + random.int(9) });
      }
    }
    return { n: n, edges: edges, source: source, sink: sink, rows: rows, columns: columns,
      name: 'grid' };
  }

  /** Every capacity 1, so the flow value is the number of edge-disjoint paths
   *  and every augmenting path pushes exactly one unit. */
  function unitNetwork(settings, random) {
    const base = layeredNetwork(settings, random);

    base.edges.forEach(function (edge) { edge.capacity = 1; });
    base.name = 'unit capacity';
    return base;
  }

  /** Matching as flow: source to every left vertex, every edge, right to sink,
   *  all at capacity one. The max flow IS the maximum matching. */
  function bipartiteNetwork(settings, random) {
    const left = settings.left || 6;
    const right = settings.right || 6;
    const n = left + right + 2;
    const source = n - 2;
    const sink = n - 1;
    const edges = [];
    const pairs = [];

    for (let a = 0; a < left; a += 1) {
      edges.push({ from: source, to: a, capacity: 1 });

      for (let b = 0; b < right; b += 1) {
        if (random.int(100) >= (settings.density || 30)) continue;
        edges.push({ from: a, to: left + b, capacity: 1 });
        pairs.push({ from: a, to: b });
      }
    }

    for (let b = 0; b < right; b += 1) edges.push({ from: left + b, to: sink, capacity: 1 });
    return { n: n, edges: edges, source: source, sink: sink, left: left, right: right,
      pairs: pairs, name: 'bipartite' };
  }

  /**
   * Image segmentation: every pixel gets a source arc worth its foreground
   * likeness and a sink arc worth its background likeness, and neighbouring
   * pixels are joined by a smoothness capacity. The minimum cut is the
   * segmentation, which is the reduction the section is about.
   */
  function segmentationNetwork(settings, random) {
    const rows = settings.rows || 6;
    const columns = settings.columns || 6;
    const smooth = settings.smooth === undefined ? 3 : settings.smooth;
    const noise = settings.noise === undefined ? 20 : settings.noise;
    const n = rows * columns + 2;
    const source = n - 2;
    const sink = n - 1;
    const edges = [];
    const intensity = [];
    const truth = [];
    const at = function (r, c) { return r * columns + c; };

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        /* The true label is the left half. `noise` per cent of pixels are
           measured as the other side, which is what the smoothness term
           exists to overrule - without noise the slider changes nothing and
           the demo teaches that smoothing is free. */
        const foreground = c < columns / 2;
        const flipped = random.int(100) < noise;
        const bright = (foreground !== flipped) ? 6 + random.int(4) : random.int(4);

        truth.push(foreground ? 1 : 0);
        intensity.push(bright);
        edges.push({ from: source, to: at(r, c), capacity: bright });
        edges.push({ from: at(r, c), to: sink, capacity: 9 - bright });

        if (c + 1 < columns) {
          edges.push({ from: at(r, c), to: at(r, c + 1), capacity: smooth });
          edges.push({ from: at(r, c + 1), to: at(r, c), capacity: smooth });
        }

        if (r + 1 >= rows) continue;
        edges.push({ from: at(r, c), to: at(r + 1, c), capacity: smooth });
        edges.push({ from: at(r + 1, c), to: at(r, c), capacity: smooth });
      }
    }
    return { n: n, edges: edges, source: source, sink: sink, rows: rows, columns: columns,
      intensity: intensity, truth: truth, smooth: smooth, noise: noise, name: 'segmentation' };
  }

  /** One narrow pipe in the middle, so the min cut is obvious by eye and the
   *  flow value is decided by two edges. */
  function bottleneckNetwork(settings) {
    const width = settings.width || 4;
    const n = 2 * width + 4;
    const source = n - 2;
    const sink = n - 1;
    const edges = [];
    const gate = 2 * width;
    const gateOut = 2 * width + 1;

    for (let i = 0; i < width; i += 1) {
      edges.push({ from: source, to: i, capacity: 10 });
      edges.push({ from: i, to: gate, capacity: 10 });
      edges.push({ from: gateOut, to: width + i, capacity: 10 });
      edges.push({ from: width + i, to: sink, capacity: 10 });
    }
    edges.push({ from: gate, to: gateOut, capacity: settings.gate || 7 });
    return { n: n, edges: edges, source: source, sink: sink, name: 'bottleneck' };
  }

  /**
   * Random arcs, but with the source wired into a few vertices and a few wired
   * into the sink. Purely random arcs leave the sink unreachable often enough
   * that the demo shows a flow of zero, which teaches nothing.
   */
  function randomNetwork(settings, random) {
    const inner = settings.n || 14;
    const n = inner + 2;
    const source = n - 2;
    const sink = n - 1;
    const edges = [];
    const seen = {};
    const add = function (a, b) {
      const key = a + '>' + b;

      if (a === b || a === sink || b === source || seen[key]) return;
      seen[key] = true;
      edges.push({ from: a, to: b, capacity: 1 + random.int(settings.capacity || 12) });
    };
    const fan = Math.max(2, Math.floor(inner / 4));

    for (let i = 0; i < fan; i += 1) {
      add(source, random.int(inner));
      add(random.int(inner), sink);
    }

    for (let i = 0; i < (settings.m || 40); i += 1) add(random.int(n), random.int(n));
    return { n: n, edges: edges, source: source, sink: sink, name: 'random' };
  }

  /* ------------------------------------------------------------ comparison */

  /**
   * Every algorithm on the same instance, with agreement reported as a field.
   * The cut row is the important one: max-flow min-cut is a theorem, so a run
   * whose cut capacity differs from its flow value has a bug somewhere the
   * value alone would never reveal.
   */
  function compareFlows(graph, options) {
    const M = modules();
    const settings = options || {};
    const source = settings.source === undefined ? graph.source : settings.source;
    const sink = settings.sink === undefined ? graph.sink : settings.sink;
    const rows = [];

    [['Ford-Fulkerson (any path)', M.MaxFlow.fordFulkerson],
      ['Edmonds-Karp (shortest path)', M.MaxFlow.edmondsKarp],
      ['Dinic (blocking flows)', M.MaxFlow.dinic],
      ['capacity scaling', M.MaxFlow.capacityScaling]].forEach(function (entry) {
      const run = entry[1](graph, source, sink, {});
      const cut = M.MaxFlow.minCut(run.network, source);

      rows.push({ name: entry[0], value: run.value, report: run.report, cut: cut,
        check: M.MaxFlow.checkFlow(run.network, source, sink) });
    });
    (settings.pushRelabel === false ? [] : [['push-relabel (FIFO)', 'fifo'],
      ['push-relabel (highest label)', 'highest']]).forEach(function (entry) {
      const run = M.PushRelabel.pushRelabel(graph, source, sink,
        { rule: entry[1], gap: true, globalRelabel: true });
      const cut = M.MaxFlow.minCut(run.network, source);

      rows.push({ name: entry[0], value: run.value, report: run.report, cut: cut,
        check: M.MaxFlow.checkFlow(run.network, source, sink) });
    });
    return summarise(rows, source, sink);
  }

  function summarise(rows, source, sink) {
    const values = rows.map(function (row) { return row.value; });
    const disagreements = values.filter(function (v) { return v !== values[0]; }).length;
    const cutMismatches = rows.filter(function (row) {
      return row.cut.capacity !== row.value;
    }).length;
    const invalid = rows.filter(function (row) { return !row.check.valid; }).length;

    return { rows: rows, value: values[0], source: source, sink: sink,
      disagreements: disagreements, cutMismatches: cutMismatches, invalid: invalid,
      agree: disagreements === 0 && cutMismatches === 0 && invalid === 0 };
  }

  /** One algorithm's run, with the flow per edge and the cut, for drawing. */
  function singleRun(graph, options) {
    const M = modules();
    const settings = options || {};
    const source = settings.source === undefined ? graph.source : settings.source;
    const sink = settings.sink === undefined ? graph.sink : settings.sink;
    const chooser = { dinic: M.MaxFlow.dinic, 'edmonds-karp': M.MaxFlow.edmondsKarp,
      'ford-fulkerson': M.MaxFlow.fordFulkerson, scaling: M.MaxFlow.capacityScaling };
    const run = (chooser[settings.algorithm] || M.MaxFlow.dinic)(graph, source, sink, {});

    return { value: run.value, network: run.network, report: run.report,
      flows: M.MaxFlow.flowOnEdges(run.network), cut: M.MaxFlow.minCut(run.network, source),
      check: M.MaxFlow.checkFlow(run.network, source, sink) };
  }

  /** Push-relabel with each heuristic combination, so the two are priced. */
  function heuristicSweep(graph, options) {
    const M = modules();
    const settings = options || {};
    const source = settings.source === undefined ? graph.source : settings.source;
    const sink = settings.sink === undefined ? graph.sink : settings.sink;

    return [[true, true], [true, false], [false, true], [false, false]].map(function (flags) {
      const run = M.PushRelabel.pushRelabel(graph, source, sink,
        { rule: settings.rule || 'fifo', gap: flags[0], globalRelabel: flags[1] });

      return { gap: flags[0], globalRelabel: flags[1], value: run.value, report: run.report,
        heights: M.PushRelabel.checkHeights(run.state, source, sink) };
    });
  }

  return {
    SHAPES: SHAPES, modules: modules, build: build,
    compareFlows: compareFlows, singleRun: singleRun, heuristicSweep: heuristicSweep,
    layeredNetwork: layeredNetwork, gridNetwork: gridNetwork,
    bipartiteNetwork: bipartiteNetwork, segmentationNetwork: segmentationNetwork
  };
}));

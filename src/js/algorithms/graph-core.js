/**
 * Graph representations, conversions and generators - the layer every other
 * M13 module is written against.
 *
 * A graph is `{ n, edges: [{ from, to, weight }], directed }`. That is the
 * *input* format, deliberately not the working one: every algorithm converts
 * to whichever representation it needs, and the conversion cost is reported
 * rather than hidden, because "adjacency list versus CSR" is a question about
 * bytes and cache lines rather than about asymptotics.
 *
 *   adjacency list   an array of arrays. Simple, and every neighbour lookup
 *                    is a pointer chase into a separately allocated array.
 *   adjacency matrix n² entries whatever the edge count. O(1) edge tests,
 *                    and unusable past a few thousand nodes.
 *   CSR              two typed arrays: `offsets` of length n + 1 and
 *                    `targets` of length m. A neighbour scan is a contiguous
 *                    read, which is why every serious graph library stores
 *                    this and why `memoryOf` reports all three.
 *
 * The generators matter as much as the algorithms. A random graph hides
 * almost every interesting failure: it has no bridges to speak of, its degree
 * distribution is tight, and its diameter is logarithmic. The grid, path,
 * star, scale-free and road-like generators are here so that a section can
 * show an algorithm behaving completely differently on inputs that are all
 * "a graph with 2 000 nodes".
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphCore = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const BYTES_PER_ENTRY = 8;
  const BYTES_PER_INDEX = 4;

  function createGraph(n, edges, options) {
    const settings = options || {};
    return { n: n, edges: edges || [], directed: Boolean(settings.directed),
      name: settings.name || 'graph' };
  }

  /* ------------------------------------------------------ representations */

  /**
   * An array of arrays of `{ to, weight, id }`. The edge id travels with the
   * entry because bridge finding needs the parent *edge* rather than the
   * parent vertex - tracking the vertex is the classic parallel-edge bug.
   */
  function adjacencyList(graph) {
    const out = [];

    for (let i = 0; i < graph.n; i += 1) out.push([]);
    graph.edges.forEach(function (edge, id) {
      out[edge.from].push({ to: edge.to, weight: edge.weight === undefined ? 1 : edge.weight, id: id });

      if (graph.directed) return;
      out[edge.to].push({ to: edge.from, weight: edge.weight === undefined ? 1 : edge.weight, id: id });
    });
    return out;
  }

  /** n² entries, whatever the edge count. `Infinity` means "no edge", which
   *  is not the same as a zero-weight edge and must not be conflated. */
  function adjacencyMatrix(graph) {
    const out = [];

    for (let i = 0; i < graph.n; i += 1) {
      out.push(new Array(graph.n).fill(Infinity));
      out[i][i] = 0;
    }
    graph.edges.forEach(function (edge) {
      const weight = edge.weight === undefined ? 1 : edge.weight;
      out[edge.from][edge.to] = Math.min(out[edge.from][edge.to], weight);

      if (graph.directed) return;
      out[edge.to][edge.from] = Math.min(out[edge.to][edge.from], weight);
    });
    return out;
  }

  /**
   * Compressed sparse row: `offsets[v]` to `offsets[v + 1]` is v's slice of
   * `targets`. A neighbour scan is then a contiguous read of two typed
   * arrays, which is the whole reason this representation exists.
   */
  function toCsr(graph) {
    const degree = new Int32Array(graph.n);
    const entries = [];

    graph.edges.forEach(function (edge, id) {
      degree[edge.from] += 1;
      entries.push({ from: edge.from, to: edge.to, weight: edge.weight === undefined ? 1 : edge.weight, id: id });

      if (graph.directed) return;
      degree[edge.to] += 1;
      entries.push({ from: edge.to, to: edge.from, weight: edge.weight === undefined ? 1 : edge.weight, id: id });
    });

    const offsets = new Int32Array(graph.n + 1);

    for (let v = 0; v < graph.n; v += 1) offsets[v + 1] = offsets[v] + degree[v];
    const cursor = Int32Array.from(offsets.subarray(0, graph.n));
    const targets = new Int32Array(entries.length);
    const weights = new Float64Array(entries.length);
    const ids = new Int32Array(entries.length);

    entries.forEach(function (entry) {
      const at = cursor[entry.from];
      targets[at] = entry.to;
      weights[at] = entry.weight;
      ids[at] = entry.id;
      cursor[entry.from] += 1;
    });
    return { n: graph.n, offsets: offsets, targets: targets, weights: weights, ids: ids };
  }

  /** The bytes each representation costs, so the comparison is a number. */
  function memoryOf(graph) {
    const directedEdges = graph.directed ? graph.edges.length : graph.edges.length * 2;
    return {
      n: graph.n,
      edges: graph.edges.length,
      adjacencyList: directedEdges * BYTES_PER_ENTRY * 3 + graph.n * BYTES_PER_ENTRY,
      adjacencyMatrix: graph.n * graph.n * BYTES_PER_ENTRY,
      csr: (graph.n + 1) * BYTES_PER_INDEX + directedEdges * (BYTES_PER_INDEX * 2 + BYTES_PER_ENTRY),
      density: graph.n <= 1 ? 0 : graph.edges.length / (graph.n * (graph.n - 1) / 2)
    };
  }

  /** Degrees, so a generator's shape can be reported rather than described. */
  function degreeStats(graph) {
    const list = adjacencyList(graph);
    let max = 0;
    let total = 0;
    let isolated = 0;

    list.forEach(function (neighbours) {
      max = Math.max(max, neighbours.length);
      total += neighbours.length;

      if (neighbours.length === 0) isolated += 1;
    });
    return { max: max, mean: graph.n === 0 ? 0 : total / graph.n, isolated: isolated };
  }

  /* ---------------------------------------------------------- generators */

  /** A `rows x columns` grid, four-connected. The shape route planning and
   *  A* are demonstrated on, because its geometry makes a heuristic possible. */
  function grid(rows, columns, options) {
    const settings = options || {};
    const random = settings.random || null;
    const edges = [];
    const at = function (r, c) { return r * columns + c; };

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        const weight = random ? 1 + random.int(settings.weightRange || 1) : 1;

        if (c + 1 < columns) edges.push({ from: at(r, c), to: at(r, c + 1), weight: weight });

        if (r + 1 < rows) edges.push({ from: at(r, c), to: at(r + 1, c), weight: weight });
      }
    }
    const graph = createGraph(rows * columns, edges, { name: 'grid' });
    graph.rows = rows;
    graph.columns = columns;
    graph.positionOf = function (v) { return { x: v % columns, y: Math.floor(v / columns) }; };
    return graph;
  }

  /** G(n, m): m distinct edges chosen uniformly. Tight degrees, logarithmic
   *  diameter, almost no bridges - which is why it must not be the only test. */
  function randomGraph(n, m, random, options) {
    const settings = options || {};
    const seen = new Set();
    const edges = [];
    let attempts = 0;

    while (edges.length < m && attempts < m * 20) {
      attempts += 1;
      const from = random.int(n);
      const to = random.int(n);

      if (from === to) continue;
      const key = settings.directed ? from + '>' + to : Math.min(from, to) + '-' + Math.max(from, to);

      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: from, to: to, weight: 1 + random.int(settings.weightRange || 20) });
    }
    return createGraph(n, edges, { directed: settings.directed, name: 'random' });
  }

  /** Preferential attachment: a few nodes of enormous degree and a long tail.
   *  The shape that breaks anything quadratic in the maximum degree. */
  function scaleFree(n, attachments, random, options) {
    const settings = options || {};
    const edges = [];
    const targets = [0];

    for (let v = 1; v < n; v += 1) {
      const chosen = new Set();

      for (let k = 0; k < Math.min(attachments, v); k += 1) {
        let pick = targets[random.int(targets.length)];
        let guard = 0;

        while (chosen.has(pick) && guard < 20) { pick = targets[random.int(targets.length)]; guard += 1; }
        chosen.add(pick);
      }
      chosen.forEach(function (pick) {
        edges.push({ from: v, to: pick, weight: 1 + random.int(settings.weightRange || 20) });
        targets.push(v);
        targets.push(pick);
      });
    }
    return createGraph(n, edges, { directed: settings.directed, name: 'scale-free' });
  }

  /**
   * A road-like graph: a grid of local streets with a sparse layer of long
   * fast edges. This is the shape contraction hierarchies exist for - plain
   * random graphs have no hierarchy to contract and CH buys nothing on them.
   */
  function roadLike(rows, columns, random, options) {
    const settings = options || {};
    const base = grid(rows, columns, { random: random, weightRange: 3 });
    const edges = base.edges.map(function (edge) {
      return { from: edge.from, to: edge.to, weight: 3 + (edge.weight % 3) };
    });
    const highways = settings.highways === undefined ? Math.floor(rows / 3) : settings.highways;

    for (let h = 0; h < highways; h += 1) {
      const row = random.int(rows);

      for (let c = 0; c + 4 < columns; c += 4) {
        edges.push({ from: row * columns + c, to: row * columns + c + 4, weight: 5 });
      }
    }
    const graph = createGraph(rows * columns, edges, { name: 'road-like' });
    graph.rows = rows;
    graph.columns = columns;
    graph.positionOf = base.positionOf;
    return graph;
  }

  /** A random DAG: edges always point from a lower index to a higher one, so
   *  the identity permutation is one valid topological order. */
  function randomDag(n, m, random, options) {
    const settings = options || {};
    const seen = new Set();
    const edges = [];
    let attempts = 0;

    while (edges.length < m && attempts < m * 20) {
      attempts += 1;
      const a = random.int(n);
      const b = random.int(n);

      if (a === b) continue;
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      const key = from + '>' + to;

      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: from, to: to, weight: 1 + random.int(settings.weightRange || 20) });
    }
    return createGraph(n, edges, { directed: true, name: 'dag' });
  }

  /** A path. Depth n, every edge a bridge, every internal vertex a cut
   *  vertex - the adversary for recursion and the best case for connectivity. */
  function path(n, options) {
    const edges = [];

    for (let v = 1; v < n; v += 1) edges.push({ from: v - 1, to: v, weight: 1 });
    return createGraph(n, edges, { directed: (options || {}).directed, name: 'path' });
  }

  /** A star. One vertex of degree n - 1 and no bridges that matter. */
  function star(n) {
    const edges = [];

    for (let v = 1; v < n; v += 1) edges.push({ from: 0, to: v, weight: 1 });
    return createGraph(n, edges, { name: 'star' });
  }

  /** Two cliques joined by a single edge: the clearest possible bridge, and
   *  an SCC condensation with exactly two components when directed. */
  function barbell(size) {
    const edges = [];
    const clique = function (offset) {
      for (let a = 0; a < size; a += 1) {
        for (let b = a + 1; b < size; b += 1) {
          edges.push({ from: offset + a, to: offset + b, weight: 1 });
        }
      }
    };

    clique(0);
    clique(size);
    edges.push({ from: size - 1, to: size, weight: 1 });
    return createGraph(size * 2, edges, { name: 'barbell' });
  }

  /** A ring of cycles: several genuine strongly connected components joined
   *  in a line, so the condensation is a path of known length. */
  function chainedCycles(components, size) {
    const edges = [];

    for (let c = 0; c < components; c += 1) {
      const base = c * size;

      for (let i = 0; i < size; i += 1) {
        edges.push({ from: base + i, to: base + ((i + 1) % size), weight: 1 });
      }

      if (c + 1 < components) edges.push({ from: base + size - 1, to: base + size, weight: 1 });
    }
    return createGraph(components * size, edges, { directed: true, name: 'chained-cycles' });
  }

  /* ---------------------------------------------------------- invariants */

  /** Does every edge name a vertex that exists? Cheap, and it catches a
   *  generator off-by-one before an algorithm reports something stranger. */
  function checkWellFormed(graph) {
    const problems = [];

    graph.edges.forEach(function (edge, id) {
      if (edge.from < 0 || edge.from >= graph.n) problems.push('edge ' + id + ' leaves node ' + edge.from);

      if (edge.to < 0 || edge.to >= graph.n) problems.push('edge ' + id + ' enters node ' + edge.to);
    });
    return { valid: problems.length === 0, problems: problems.slice(0, 8) };
  }

  /** Undirected, with every edge reversed as well. Some algorithms want the
   *  reverse graph specifically (Kosaraju's second pass). */
  function reverse(graph) {
    return createGraph(graph.n, graph.edges.map(function (edge) {
      return { from: edge.to, to: edge.from, weight: edge.weight };
    }), { directed: graph.directed, name: graph.name + ' (reversed)' });
  }

  /** Add k parallel copies of an existing edge - the input that separates a
   *  correct bridge finder from one that tracks the parent vertex. */
  function withParallelEdges(graph, count) {
    const edges = graph.edges.slice();

    for (let i = 0; i < count && i < graph.edges.length; i += 1) {
      edges.push({ from: graph.edges[i].from, to: graph.edges[i].to, weight: graph.edges[i].weight });
    }
    return createGraph(graph.n, edges, { directed: graph.directed, name: graph.name + ' + parallel' });
  }

  return {
    createGraph: createGraph,
    adjacencyList: adjacencyList, adjacencyMatrix: adjacencyMatrix, toCsr: toCsr,
    memoryOf: memoryOf, degreeStats: degreeStats,
    grid: grid, randomGraph: randomGraph, scaleFree: scaleFree, roadLike: roadLike,
    randomDag: randomDag, path: path, star: star, barbell: barbell, chainedCycles: chainedCycles,
    checkWellFormed: checkWellFormed, reverse: reverse, withParallelEdges: withParallelEdges
  };
}));

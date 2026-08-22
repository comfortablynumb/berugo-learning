/**
 * Graph layout: force-directed placement, Sugiyama layering, and the crossing
 * count that decides whether either produced a readable picture.
 *
 * Force-directed layout is a physics analogy - every pair of vertices repels,
 * every edge attracts, and a cooling schedule caps how far a vertex may move
 * per step. It has no notion of "readable" and optimises an energy that is
 * only a proxy for one, which is why the crossing count is reported
 * separately: a layout can reach a low energy and still be unreadable.
 *
 * Layered (Sugiyama) layout is the algorithm behind every diagram in this
 * platform. It assigns each vertex to a layer by longest path, inserts *dummy*
 * vertices so that no edge spans more than one layer, and then reorders within
 * layers by barycentre to reduce crossings. The dummy nodes are the part
 * people forget, and they are what makes a long edge route cleanly instead of
 * cutting through three rows of boxes.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Layout = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { iterations: 0, pairForces: 0, edgeForces: 0, crossings: 0,
      dummyNodes: 0, layers: 0, sweeps: 0 };
  }

  /* -------------------------------------------------------- the geometry */

  function circularLayout(n, radius) {
    const r = radius === undefined ? 1 : radius;
    const out = [];

    for (let v = 0; v < n; v += 1) {
      const angle = (2 * Math.PI * v) / Math.max(1, n);

      out.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
    }
    return out;
  }

  /** A deterministic starting placement. Force-directed layout is chaotic in
   *  its initial conditions, so "deterministic for a given seed" is a property
   *  worth having and worth testing. */
  function seededLayout(n, seed) {
    const out = [];
    let state = (seed || 1) >>> 0;

    for (let v = 0; v < n; v += 1) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const x = (state / 4294967296) * 2 - 1;

      state = (state * 1664525 + 1013904223) >>> 0;
      out.push({ x: x, y: (state / 4294967296) * 2 - 1 });
    }
    return out;
  }

  /* --------------------------------------------------- Fruchterman-Reingold */

  function repulsionInto(displacement, positions, k, report) {
    for (let v = 0; v < positions.length; v += 1) {
      for (let w = v + 1; w < positions.length; w += 1) {
        report.pairForces += 1;
        let dx = positions[v].x - positions[w].x;
        let dy = positions[v].y - positions[w].y;
        let distance = Math.hypot(dx, dy);

        if (distance < 1e-9) { dx = 1e-6 * (v + 1); dy = 1e-6 * (w + 1); distance = Math.hypot(dx, dy); }
        const force = (k * k) / distance;

        displacement[v].x += (dx / distance) * force;
        displacement[v].y += (dy / distance) * force;
        displacement[w].x -= (dx / distance) * force;
        displacement[w].y -= (dy / distance) * force;
      }
    }
  }

  function attractionInto(displacement, positions, edges, context) {
    edges.forEach(function (edge) {
      context.report.edgeForces += 1;
      const dx = positions[edge.from].x - positions[edge.to].x;
      const dy = positions[edge.from].y - positions[edge.to].y;
      const distance = Math.max(1e-9, Math.hypot(dx, dy));
      const force = (distance * distance) / context.k;

      displacement[edge.from].x -= (dx / distance) * force;
      displacement[edge.from].y -= (dy / distance) * force;
      displacement[edge.to].x += (dx / distance) * force;
      displacement[edge.to].y += (dy / distance) * force;
    });
  }

  /**
   * One iteration: repulsion between every pair, attraction along every edge,
   * then a move capped by the current temperature. The cap is what makes the
   * schedule converge rather than oscillate, and removing it is the usual
   * reason a layout never settles.
   */
  function forceStep(positions, edges, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const k = settings.k || Math.sqrt(1 / Math.max(1, positions.length));
    const temperature = settings.temperature === undefined ? 0.1 : settings.temperature;
    const displacement = positions.map(function () { return { x: 0, y: 0 }; });

    repulsionInto(displacement, positions, k, report);
    attractionInto(displacement, positions, edges, { k: k, report: report });
    report.iterations += 1;
    return positions.map(function (point, v) {
      const length = Math.max(1e-9, Math.hypot(displacement[v].x, displacement[v].y));
      const move = Math.min(length, temperature);

      return { x: point.x + (displacement[v].x / length) * move,
        y: point.y + (displacement[v].y / length) * move };
    });
  }

  /**
   * The energy the step is descending: repulsion as a logarithm of distance
   * and attraction as a cube. Reported because "it converged" should be a
   * measured curve rather than an assertion.
   */
  function energy(positions, edges, k) {
    const scale = k || Math.sqrt(1 / Math.max(1, positions.length));
    let total = 0;

    for (let v = 0; v < positions.length; v += 1) {
      for (let w = v + 1; w < positions.length; w += 1) {
        const distance = Math.max(1e-9, Math.hypot(positions[v].x - positions[w].x,
          positions[v].y - positions[w].y));

        total -= scale * scale * Math.log(distance);
      }
    }
    edges.forEach(function (edge) {
      const distance = Math.hypot(positions[edge.from].x - positions[edge.to].x,
        positions[edge.from].y - positions[edge.to].y);

      total += (distance * distance * distance) / (3 * scale);
    });
    return total;
  }

  /** A full run under a fixed cooling schedule. */
  function forceLayout(graph, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const steps = settings.steps || 200;
    const k = settings.k || Math.sqrt(1 / Math.max(1, graph.n));
    let positions = settings.start || seededLayout(graph.n, settings.seed || 1);
    const curve = [];

    for (let step = 0; step < steps; step += 1) {
      const temperature = (settings.temperature || 0.1) * (1 - step / steps);

      curve.push(energy(positions, graph.edges, k));
      positions = forceStep(positions, graph.edges,
        { k: k, temperature: temperature, report: report });
    }
    curve.push(energy(positions, graph.edges, k));
    return { positions: positions, energy: curve, report: report };
  }

  /* ---------------------------------------------------------- crossings */

  function segmentsCross(a, b, c, d) {
    const side = function (p, q, r) {
      return Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    };
    const d1 = side(a, b, c);
    const d2 = side(a, b, d);
    const d3 = side(c, d, a);
    const d4 = side(c, d, b);

    return d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
  }

  /** How many pairs of edges cross. This is the readability number, and it is
   *  the one a force model does not optimise. */
  function crossings(positions, edges) {
    let count = 0;

    for (let i = 0; i < edges.length; i += 1) {
      for (let j = i + 1; j < edges.length; j += 1) {
        const a = edges[i];
        const b = edges[j];

        if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;

        if (!segmentsCross(positions[a.from], positions[a.to],
          positions[b.from], positions[b.to])) continue;
        count += 1;
      }
    }
    return count;
  }

  /* ------------------------------------------------------ layered layout */

  /** Longest-path layering: a vertex sits one below its deepest predecessor.
   *  Requires a DAG, which is why cycle removal is step zero in Sugiyama. */
  function assignLayers(n, edges, report) {
    const indegree = new Array(n).fill(0);
    const out = [];

    for (let v = 0; v < n; v += 1) out.push([]);
    edges.forEach(function (edge) {
      out[edge.from].push(edge.to);
      indegree[edge.to] += 1;
    });
    const layer = new Array(n).fill(0);
    const ready = [];

    for (let v = 0; v < n; v += 1) {
      if (indegree[v] === 0) ready.push(v);
    }
    let placed = 0;

    while (ready.length) {
      const v = ready.shift();

      placed += 1;
      out[v].forEach(function (w) {
        layer[w] = Math.max(layer[w], layer[v] + 1);
        indegree[w] -= 1;

        if (indegree[w] !== 0) return;
        ready.push(w);
      });
    }
    report.layers = Math.max.apply(null, layer.concat([0])) + 1;
    return { layer: layer, acyclic: placed === n };
  }

  /**
   * Split every edge that spans more than one layer into a chain through dummy
   * vertices. Without this a long edge is drawn straight through the rows in
   * between, which is what makes a generated diagram unreadable.
   */
  function insertDummies(n, edges, layer, report) {
    const nodes = layer.slice();
    const segments = [];

    edges.forEach(function (edge) {
      let from = edge.from;

      for (let level = layer[edge.from] + 1; level < layer[edge.to]; level += 1) {
        const dummy = nodes.length;

        nodes.push(level);
        report.dummyNodes += 1;
        segments.push({ from: from, to: dummy, dummy: true });
        from = dummy;
      }
      segments.push({ from: from, to: edge.to, dummy: false });
    });
    return { layer: nodes, edges: segments, n: nodes.length };
  }

  /** Order within a layer by the mean position of the neighbours in the layer
   *  above, swept downwards then upwards. Cheap, and it is what most layered
   *  drawing engines actually do. */
  function barycentreSweep(expanded, order, report) {
    const position = new Array(expanded.n).fill(0);

    order.forEach(function (row) { row.forEach(function (v, i) { position[v] = i; }); });
    const incoming = [];

    for (let v = 0; v < expanded.n; v += 1) incoming.push([]);
    expanded.edges.forEach(function (edge) { incoming[edge.to].push(edge.from); });
    report.sweeps += 1;
    return order.map(function (row, level) {
      if (level === 0) return row;
      return row.slice().sort(function (a, b) {
        return barycentre(incoming[a], position) - barycentre(incoming[b], position);
      });
    });
  }

  function barycentre(neighbours, position) {
    if (neighbours.length === 0) return 0;
    return neighbours.reduce(function (sum, v) { return sum + position[v]; }, 0) / neighbours.length;
  }

  /** Layer, insert dummies, order by barycentre, then place on a grid. */
  function layeredLayout(graph, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const assigned = assignLayers(graph.n, graph.edges, report);

    if (!assigned.acyclic) return { positions: null, refused: 'the graph has a cycle', report: report };
    const expanded = insertDummies(graph.n, graph.edges, assigned.layer, report);
    let order = [];

    for (let level = 0; level < report.layers; level += 1) order.push([]);
    expanded.layer.forEach(function (level, v) { order[level].push(v); });

    for (let pass = 0; pass < (settings.sweeps || 4); pass += 1) {
      order = barycentreSweep(expanded, order, report);
    }
    const positions = new Array(expanded.n).fill(null);

    order.forEach(function (row, level) {
      row.forEach(function (v, i) {
        positions[v] = { x: i - (row.length - 1) / 2, y: level };
      });
    });
    return { positions: positions.slice(0, graph.n), all: positions, layer: assigned.layer,
      expanded: expanded, report: report };
  }

  return {
    emptyReport: emptyReport, circularLayout: circularLayout, seededLayout: seededLayout,
    forceStep: forceStep, forceLayout: forceLayout, energy: energy,
    crossings: crossings, segmentsCross: segmentsCross,
    assignLayers: assignLayers, insertDummies: insertDummies, layeredLayout: layeredLayout
  };
}));

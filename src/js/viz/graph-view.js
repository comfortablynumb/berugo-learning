/**
 * GraphView - canvas rendering for graphs, with per-step highlighting.
 *
 * Canvas rather than SVG, and the reason is a measurement rather than a
 * preference: a 2 000-node graph with 6 000 edges is 8 000 SVG elements, and
 * the sections here reach that. Canvas draws it in one pass and redraws it on
 * every control change without touching the DOM.
 *
 * The cost of that choice is that nothing is individually addressable, so
 * every highlight has to be passed in as data and the whole scene redrawn.
 * That is why `draw()` takes a complete description rather than exposing
 * per-node handles - a half-updated scene is the bug this avoids.
 *
 * Two layouts, because the sections need different things. A **fixed** layout
 * places nodes at coordinates the graph itself supplies, which is what a grid
 * or a road network has and is the only honest way to draw a route. A
 * **circular** layout places them on a ring, which shows structure - SCCs,
 * bridges, a condensation - without pretending the positions mean anything.
 * A force layout is deliberately absent: it is slow, it is not reproducible
 * across runs, and a section whose figures move when you reload is unusable.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GraphView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const MAX_EDGES = 12000;
  const MAX_NODES = 4000;
  const PADDING = 14;

  function paletteOf() {
    if (scope && scope.Palette && scope.Palette.tokens) return scope.Palette.tokens();
    return {};
  }

  function cssVar(name, fallback) {
    if (!scope || !scope.document || !scope.getComputedStyle) return fallback;
    const value = scope.getComputedStyle(scope.document.documentElement).getPropertyValue(name);
    return value && value.trim() ? value.trim() : fallback;
  }

  function colours() {
    return {
      edge: cssVar('--border-strong', '#94a3b8'),
      node: cssVar('--text-muted', '#64748b'),
      surface: cssVar('--surface', '#ffffff'),
      text: cssVar('--text-primary', '#0f172a'),
      settled: cssVar('--hue-blue', '#3b82f6'),
      frontier: cssVar('--hue-amber', '#f59e0b'),
      path: cssVar('--hue-green', '#22c55e'),
      cut: cssVar('--hue-red', '#ef4444'),
      tree: cssVar('--hue-teal', '#14b8a6'),
      extra: cssVar('--hue-purple', '#a855f7')
    };
  }

  /* ------------------------------------------------------------- layouts */

  /**
   * Coordinates the graph supplies, scaled into the canvas. The only layout
   * that means anything for a route: a path drawn over invented positions is
   * a picture of the layout rather than of the answer.
   */
  function fixedLayout(graph, width, height) {
    const positions = [];
    let maxX = 0;
    let maxY = 0;

    for (let v = 0; v < graph.n; v += 1) {
      const p = graph.positionOf(v);
      positions.push(p);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const scaleX = (width - 2 * PADDING) / Math.max(1, maxX);
    const scaleY = (height - 2 * PADDING) / Math.max(1, maxY);
    return positions.map(function (p) {
      return { x: PADDING + p.x * scaleX, y: PADDING + p.y * scaleY };
    });
  }

  /** A ring. Says nothing about distance and everything about structure. */
  function circularLayout(n, width, height) {
    const radius = Math.min(width, height) / 2 - PADDING;
    const cx = width / 2;
    const cy = height / 2;
    const out = [];

    for (let v = 0; v < n; v += 1) {
      const angle = (2 * Math.PI * v) / Math.max(1, n) - Math.PI / 2;
      out.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
    }
    return out;
  }

  /**
   * Grouped rings: one ring per group, arranged on an outer ring. This is how
   * strongly connected components and biconnected blocks are drawn, because
   * the grouping is the answer and a single ring hides it.
   */
  function groupedLayout(groups, n, width, height) {
    const positions = new Array(n).fill(null);
    const count = groups.length;
    const outerRadius = Math.min(width, height) / 2 - PADDING * 3;
    const cx = width / 2;
    const cy = height / 2;

    groups.forEach(function (members, g) {
      const angle = (2 * Math.PI * g) / Math.max(1, count) - Math.PI / 2;
      const gx = count === 1 ? cx : cx + outerRadius * Math.cos(angle);
      const gy = count === 1 ? cy : cy + outerRadius * Math.sin(angle);
      const inner = Math.min(PADDING * 2.2, outerRadius / Math.max(2, Math.sqrt(count)));

      members.forEach(function (v, i) {
        if (members.length === 1) { positions[v] = { x: gx, y: gy }; return; }
        const a = (2 * Math.PI * i) / members.length;
        positions[v] = { x: gx + inner * Math.cos(a), y: gy + inner * Math.sin(a) };
      });
    });

    for (let v = 0; v < n; v += 1) {
      if (positions[v]) continue;
      positions[v] = { x: cx, y: cy };
    }
    return positions;
  }

  /* ------------------------------------------------------------ drawing */

  function contextFor(host, width, height) {
    if (!scope || !scope.document) return null;
    const ratio = scope.devicePixelRatio || 1;
    let canvas = host.querySelector('canvas');

    if (!canvas) {
      canvas = scope.document.createElement('canvas');
      host.innerHTML = '';
      host.appendChild(canvas);
    }
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const context = canvas.getContext('2d');

    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }

  /**
   * `draw({ host, graph, positions, edgeClass, nodeClass, path, labels })`.
   *
   * `edgeClass` and `nodeClass` map an id to one of the keys in `colours()`,
   * so a section decides the meaning and this file decides nothing.
   */
  function draw(options) {
    const settings = options || {};
    const host = settings.host;

    if (!host) return null;
    const width = settings.width || host.clientWidth || 640;
    const height = settings.height || 380;
    const context = contextFor(host, width, height);

    if (!context) return null;
    const tone = colours();
    const positions = settings.positions;
    const graph = settings.graph;

    context.clearRect(0, 0, width, height);
    const drawn = drawEdges(context, graph, positions, settings, tone);
    drawPath(context, positions, settings.path, tone);
    const nodes = drawNodes(context, graph, positions, settings, tone);
    return { edgesDrawn: drawn, nodesDrawn: nodes,
      truncated: drawn < graph.edges.length || nodes < graph.n };
  }

  function drawEdges(context, graph, positions, settings, tone) {
    const limit = Math.min(graph.edges.length, MAX_EDGES);
    const edgeClass = settings.edgeClass || function () { return null; };

    context.lineWidth = 1;

    for (let id = 0; id < limit; id += 1) {
      const edge = graph.edges[id];
      const a = positions[edge.from];
      const b = positions[edge.to];

      if (!a || !b) continue;
      const kind = edgeClass(id, edge);
      context.strokeStyle = kind ? tone[kind] || tone.edge : tone.edge;
      context.globalAlpha = kind ? 0.95 : 0.25;
      context.lineWidth = kind ? 2 : 1;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    context.globalAlpha = 1;
    return limit;
  }

  /** The answer, drawn last among the lines so nothing sits on top of it. */
  function drawPath(context, positions, path, tone) {
    if (!path || path.length < 2) return;
    context.strokeStyle = tone.path;
    context.lineWidth = 3;
    context.globalAlpha = 0.95;
    context.beginPath();
    context.moveTo(positions[path[0]].x, positions[path[0]].y);

    for (let i = 1; i < path.length; i += 1) {
      if (!positions[path[i]]) continue;
      context.lineTo(positions[path[i]].x, positions[path[i]].y);
    }
    context.stroke();
    context.globalAlpha = 1;
  }

  function drawNodes(context, graph, positions, settings, tone) {
    const limit = Math.min(graph.n, MAX_NODES);
    const nodeClass = settings.nodeClass || function () { return null; };
    const radius = settings.radius || (graph.n > 600 ? 1.8 : (graph.n > 200 ? 2.6 : 4));

    for (let v = 0; v < limit; v += 1) {
      const p = positions[v];

      if (!p) continue;
      const kind = nodeClass(v);
      context.fillStyle = kind ? tone[kind] || tone.node : tone.node;
      context.globalAlpha = kind ? 1 : 0.55;
      context.beginPath();
      context.arc(p.x, p.y, kind ? radius * 1.5 : radius, 0, 2 * Math.PI);
      context.fill();
    }
    context.globalAlpha = 1;
    drawLabels(context, positions, settings, tone);
    return limit;
  }

  /** Labels only when there are few enough to read - past about forty nodes
   *  they overlap into noise and are worse than nothing. */
  function drawLabels(context, positions, settings, tone) {
    if (!settings.labels || settings.labels.length > 40) return;
    context.fillStyle = tone.text;
    context.font = '10px system-ui, sans-serif';
    context.textAlign = 'center';
    settings.labels.forEach(function (label) {
      const p = positions[label.node];

      if (!p) return;
      context.fillText(String(label.text), p.x, p.y - 7);
    });
  }

  /* ------------------------------------------------------------ helpers */

  /** A colouring function from a component labelling, cycling a small palette
   *  so adjacent components are distinguishable without inventing 500 hues. */
  function classByGroup(labels) {
    const names = ['settled', 'frontier', 'path', 'cut', 'tree', 'extra'];
    return function (v) { return names[labels[v] % names.length]; };
  }

  /** A colouring from a set of ids - the usual case for "these edges are the
   *  answer" - returning null for everything else so it draws faint. */
  function classBySet(ids, name) {
    const set = ids instanceof Set ? ids : new Set(ids);
    return function (id) { return set.has(id) ? name : null; };
  }

  return {
    MAX_EDGES: MAX_EDGES, MAX_NODES: MAX_NODES,
    fixedLayout: fixedLayout, circularLayout: circularLayout, groupedLayout: groupedLayout,
    draw: draw, classByGroup: classByGroup, classBySet: classBySet, colours: colours,
    paletteOf: paletteOf
  };
}));

/**
 * FlowView - a flow network and its residual, drawn side by side.
 *
 * Two things make this different from the general graph renderer. A flow
 * network has a source and a sink, so the layout is *layered* by distance from
 * the source rather than circular - a ring hides the one structure the picture
 * is about. And every edge carries two numbers, flow and capacity, so a
 * saturated edge is drawn differently from a half-used one: saturation is what
 * a cut is made of, and it should be visible without reading the labels.
 *
 * The residual panel is the point of the whole section. It draws the same
 * vertices with the *remaining* capacities, including the back edges that do
 * not exist in the input at all, because those back edges are what let a later
 * augmenting path undo an earlier routing decision.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.FlowView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const PADDING = 26;
  const MAX_LABELS = 60;

  function palette() {
    if (scope && scope.GraphView) return scope.GraphView.colours();
    return { node: '#888', edge: '#bbb', settled: '#4c8', frontier: '#48c', path: '#e83',
      cut: '#c44', tree: '#8a5', extra: '#a6c', text: '#333' };
  }

  /* --------------------------------------------------------- the layout */

  /** Layer by distance from the source over edges with any capacity, so the
   *  picture reads left to right and the sink is on the right. */
  function layeredPositions(graph, width, height) {
    const level = levelsFrom(graph);
    const rows = {};
    let deepest = 0;

    level.forEach(function (value) { deepest = Math.max(deepest, value); });
    level.forEach(function (value, v) {
      rows[value] = rows[value] || [];
      rows[value].push(v);
    });
    const positions = new Array(graph.n).fill(null);
    const spanX = (width - 2 * PADDING) / Math.max(1, deepest);

    Object.keys(rows).forEach(function (key) {
      const row = rows[key];
      const spanY = (height - 2 * PADDING) / Math.max(1, row.length);

      row.forEach(function (v, i) {
        positions[v] = { x: PADDING + Number(key) * spanX,
          y: PADDING + spanY * (i + 0.5) };
      });
    });
    return positions;
  }

  function levelsFrom(graph) {
    const adjacency = [];

    for (let v = 0; v < graph.n; v += 1) adjacency.push([]);
    graph.edges.forEach(function (edge) {
      adjacency[edge.from].push(edge.to);
      adjacency[edge.to].push(edge.from);
    });
    const level = new Array(graph.n).fill(0);
    const seen = new Array(graph.n).fill(false);
    const queue = [graph.source];

    seen[graph.source] = true;

    while (queue.length) {
      const v = queue.shift();

      adjacency[v].forEach(function (w) {
        if (seen[w]) return;
        seen[w] = true;
        level[w] = level[v] + 1;
        queue.push(w);
      });
    }
    level[graph.sink] = Math.max.apply(null, level) + 1;
    return level;
  }

  function contextFor(host, width, height) {
    if (!host || typeof host.getBoundingClientRect !== 'function') return null;
    let canvas = host.querySelector('canvas');

    if (!canvas) {
      canvas = host.ownerDocument.createElement('canvas');
      host.appendChild(canvas);
    }
    const ratio = (scope && scope.devicePixelRatio) || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const context = canvas.getContext('2d');

    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }

  /* ---------------------------------------------------------- the drawing */

  function drawArrow(context, a, b, shrink) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const tipX = b.x - Math.cos(angle) * shrink;
    const tipY = b.y - Math.sin(angle) * shrink;

    context.beginPath();
    context.moveTo(a.x + Math.cos(angle) * shrink, a.y + Math.sin(angle) * shrink);
    context.lineTo(tipX, tipY);
    context.stroke();
    context.beginPath();
    context.moveTo(tipX, tipY);
    context.lineTo(tipX - Math.cos(angle - 0.4) * 6, tipY - Math.sin(angle - 0.4) * 6);
    context.lineTo(tipX - Math.cos(angle + 0.4) * 6, tipY - Math.sin(angle + 0.4) * 6);
    context.closePath();
    context.fill();
  }

  function edgeTone(entry, tone, cutIds) {
    if (cutIds && cutIds.has(entry.id)) return { colour: tone.cut, width: 3, alpha: 1 };

    if (entry.flow <= 0) return { colour: tone.edge, width: 1, alpha: 0.28 };

    if (entry.flow >= entry.capacity) return { colour: tone.path, width: 2.6, alpha: 0.95 };
    return { colour: tone.settled, width: 2, alpha: 0.8 };
  }

  function drawFlowEdges(context, options, positions, tone) {
    const cutIds = options.cut ? new Set(options.cut.map(function (e) { return e.id; })) : null;

    options.flows.forEach(function (entry, id) {
      const a = positions[entry.from];
      const b = positions[entry.to];

      if (!a || !b) return;
      const style = edgeTone({ id: id, flow: entry.flow, capacity: entry.capacity }, tone, cutIds);

      context.strokeStyle = style.colour;
      context.fillStyle = style.colour;
      context.lineWidth = style.width;
      context.globalAlpha = style.alpha;
      drawArrow(context, a, b, 7);
    });
    context.globalAlpha = 1;
  }

  /** Flow over capacity, on the edges that carry any. Past sixty labels the
   *  picture is worse with them than without. */
  function drawLabels(context, options, positions, tone) {
    const carrying = options.flows.filter(function (entry) { return entry.flow > 0; });

    if (carrying.length > MAX_LABELS) return;
    context.fillStyle = tone.text;
    context.font = '10px system-ui, sans-serif';
    context.textAlign = 'center';
    carrying.forEach(function (entry) {
      const a = positions[entry.from];
      const b = positions[entry.to];

      if (!a || !b) return;
      context.fillText(entry.flow + '/' + entry.capacity, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3);
    });
  }

  function drawNodes(context, options, positions, tone) {
    const side = options.cut ? options.cutSide : null;

    positions.forEach(function (point, v) {
      if (!point) return;
      const terminal = v === options.graph.source || v === options.graph.sink;

      context.fillStyle = terminal ? tone.frontier : (side && side[v] ? tone.tree : tone.node);
      context.globalAlpha = terminal ? 1 : 0.75;
      context.beginPath();
      context.arc(point.x, point.y, terminal ? 6 : 4, 0, 2 * Math.PI);
      context.fill();
    });
    context.globalAlpha = 1;
  }

  /**
   * `flows` is what `MaxFlow.flowOnEdges` returns; `cut` is the crossing-edge
   * list from `MaxFlow.minCut`, and `cutSide` its `side` array. Passing the
   * cut is what turns the picture from "a flow" into "a flow and the reason
   * it cannot be larger".
   */
  function draw(options) {
    const settings = options || {};
    const host = settings.host;

    if (!host) return null;
    const width = settings.width || host.clientWidth || 620;
    const height = settings.height || 320;
    const context = contextFor(host, width, height);

    if (!context) return null;
    const tone = palette();
    const positions = settings.positions || layeredPositions(settings.graph, width, height);

    context.clearRect(0, 0, width, height);
    drawFlowEdges(context, settings, positions, tone);
    drawLabels(context, settings, positions, tone);
    drawNodes(context, settings, positions, tone);
    return { positions: positions, drawn: settings.flows.length };
  }

  /**
   * The residual: forward capacity where any is left, and a *back* arc
   * wherever flow is carried. The back arcs are the ones that do not exist in
   * the input, and they are the whole reason the algorithm is correct.
   */
  function residualEdges(flows) {
    const out = [];

    flows.forEach(function (entry) {
      if (entry.capacity - entry.flow > 0) {
        out.push({ from: entry.from, to: entry.to, capacity: entry.capacity - entry.flow,
          flow: 0, kind: 'forward' });
      }

      if (entry.flow <= 0) return;
      out.push({ from: entry.to, to: entry.from, capacity: entry.flow, flow: 0, kind: 'back' });
    });
    return out;
  }

  return {
    PADDING: PADDING, MAX_LABELS: MAX_LABELS,
    layeredPositions: layeredPositions, levelsFrom: levelsFrom,
    draw: draw, residualEdges: residualEdges, edgeTone: edgeTone
  };
}));

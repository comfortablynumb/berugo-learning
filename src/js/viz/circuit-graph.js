/**
 * CircuitGraph - a netlist as a mermaid diagram.
 *
 * A schematic drawn by hand is a picture of what somebody meant; this is a
 * picture of what the simulator is actually running, generated from the same
 * netlist, so the two cannot drift. It lives in a module rather than in a
 * section for the same reason the implication graph in 32.5 does: a definition
 * built at run time is not covered by the guard that parses every section's
 * static diagram, and as a module it can be handed to the real parser in a
 * test.
 *
 * Gate shapes carry meaning: inputs are stadiums, flip-flops are subroutine
 * boxes (they are the only nodes with memory), and everything else is a plain
 * box labelled with its type. A node on the critical path is marked, because
 * the whole point of drawing the circuit beside the timing report is to see
 * where the delay is.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CircuitGraph = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const LIMIT = 26;

  function safeId(id) {
    return 'g' + String(id).replace(/[^A-Za-z0-9]/g, '_');
  }

  function labelFor(net, id, options) {
    const node = net.nodes[id];
    const named = net.outputs.filter(function (row) { return row.id === id; })[0];
    const parts = [node.type === 'input' ? node.label : node.type];

    if (named) parts.push('out: ' + named.label);
    if (options.values && options.values[id] !== undefined) {
      parts.push('= ' + options.values[id]);
    }
    return parts.join('<br/>');
  }

  function shapeFor(net, id, options) {
    const node = net.nodes[id];
    const text = '"' + labelFor(net, id, options) + '"';

    if (node.type === 'input') return safeId(id) + '([' + text + '])';
    if (node.type === 'dff') return safeId(id) + '[[' + text + ']]';
    if (options.critical && options.critical[id]) return safeId(id) + '{{' + text + '}}';
    return safeId(id) + '[' + text + ']';
  }

  /**
   * The whole netlist when it is small enough to read, and a stated refusal
   * when it is not. A diagram of four hundred gates is not a diagram.
   */
  function definition(net, options) {
    const settings = options || {};
    const limit = settings.limit || LIMIT;
    const shown = net.order.filter(function (id) {
      return settings.include ? settings.include[id] : true;
    });

    if (shown.length > limit) {
      return { tooLarge: true, nodes: shown.length,
        why: net.order.length + ' nodes is past the ' + limit + ' this can draw legibly' };
    }
    return { tooLarge: false, nodes: shown.length,
      text: linesFor(net, shown, settings).join('\n') };
  }

  function linesFor(net, shown, settings) {
    const present = {};
    const lines = ['flowchart LR'];

    shown.forEach(function (id) { present[id] = true; });
    shown.forEach(function (id) { lines.push('  ' + shapeFor(net, id, settings)); });
    shown.forEach(function (id) {
      net.nodes[id].inputs.forEach(function (source, port) {
        if (source === null || !present[source]) return;
        lines.push('  ' + safeId(source) + edgeFor(net, id, port) + safeId(id));
      });
    });
    return lines;
  }

  /** A flip-flop's two ports are not interchangeable, and a diagram that does
   *  not say which is which is a diagram of a different circuit. */
  function edgeFor(net, id, port) {
    if (net.nodes[id].type !== 'dff') return ' --> ';
    return port === 1 ? ' -->|"clock"| ' : ' -->|"d"| ';
  }

  /** The ids on a path, as a set the definition can mark. */
  function markPath(path) {
    const marked = {};

    (path || []).forEach(function (step) { marked[step.id] = true; });
    return marked;
  }

  return { definition: definition, markPath: markPath, safeId: safeId,
    labelFor: labelFor, LIMIT: LIMIT };
}));

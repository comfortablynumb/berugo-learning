/**
 * ParseTreeView — parse trees and parse forests, drawn.
 *
 * A parse tree is the one picture the whole of M25 keeps coming back to:
 * ambiguity is two trees over one input, precedence is a tree shape, a grammar
 * transformation is a tree that changed while the language did not. Drawing it
 * beside the table that produced it is what makes those claims checkable rather
 * than asserted.
 *
 * Layout is the classic tidy algorithm reduced to its useful half: leaves get
 * consecutive x slots in order, an internal node sits at the mean of its
 * children, and depth sets y. That is not Reingold–Tilford — it does not
 * compact subtrees — but for a tree small enough to read it produces the same
 * picture, and the code is thirty lines instead of two hundred.
 *
 * A forest is drawn as a DAG: a node with two derivations gets a diamond
 * marker and both packings are drawn from it, so the sharing that keeps an
 * exponential tree count polynomial is visible rather than described.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ParseTreeView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const LEAF_GAP = 46;
  const LEVEL_GAP = 54;
  const MAX_LEAVES = 40;

  /* --------------------------------------------------------------- layout */

  /**
   * Assign every node an x and a y. Leaves take the next slot; an internal
   * node centres over its children, which is what makes a tree with an
   * unbalanced subtree still look like the derivation it is.
   */
  function layout(tree) {
    const nodes = [];
    const edges = [];
    const cursor = { next: 0 };

    place(tree, 0, nodes, edges, cursor);
    return { nodes: nodes, edges: edges, leaves: cursor.next,
      depth: nodes.reduce(function (best, n) { return Math.max(best, n.depth); }, 0) };
  }

  function place(tree, depth, nodes, edges, cursor) {
    const entry = { symbol: label(tree), depth: depth, x: 0, y: depth * LEVEL_GAP + 22,
      leaf: !tree.children || tree.children.length === 0 };

    nodes.push(entry);
    if (entry.leaf) {
      entry.x = cursor.next * LEAF_GAP + LEAF_GAP / 2;
      cursor.next += 1;
      return entry;
    }
    const children = tree.children.map(function (child) {
      return place(child, depth + 1, nodes, edges, cursor);
    });

    entry.x = children.reduce(function (total, child) { return total + child.x; }, 0)
      / children.length;
    children.forEach(function (child) { edges.push({ from: entry, to: child }); });
    return entry;
  }

  function label(tree) {
    if (tree.symbol === '' || tree.symbol === undefined) return 'ε';
    return tree.symbol;
  }

  /* ---------------------------------------------------------------- markup */

  function escapeText(value) {
    return String(value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  /**
   * One tree as standalone SVG markup. Markup rather than a D3 render because
   * the render audit has no layout engine and a string is testable — the same
   * decision `viz/automaton-view.js` made.
   */
  function markup(config) {
    const tree = config.tree;

    if (!tree) return empty(config, 'no parse — nothing to draw');
    const laid = layout(tree);

    if (laid.leaves > (config.maxLeaves || MAX_LEAVES)) {
      return empty(config, laid.leaves + ' leaves — too wide to draw; the shape line carries it');
    }
    const size = { width: Math.max(240, laid.leaves * LEAF_GAP),
      height: (laid.depth + 1) * LEVEL_GAP + 26 };

    return open(size, config.ariaLabel || 'parse tree') +
      laid.edges.map(edgeLine).join('') +
      laid.nodes.map(function (node) { return nodeMark(node, config); }).join('') +
      '</svg>';
  }

  function open(size, ariaLabel) {
    return '<svg viewBox="0 0 ' + size.width + ' ' + size.height +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
      escapeText(ariaLabel) + '">';
  }

  function empty(config, message) {
    const size = { width: config.width || 420, height: config.height || 140 };

    return open(size, message) + '<text x="' + (size.width / 2) + '" y="' +
      (size.height / 2) + '" text-anchor="middle" class="chart-text">' +
      escapeText(message) + '</text></svg>';
  }

  function edgeLine(edge) {
    return '<line x1="' + round(edge.from.x) + '" y1="' + (edge.from.y + 9) +
      '" x2="' + round(edge.to.x) + '" y2="' + (edge.to.y - 13) +
      '" class="tree-edge" />';
  }

  function nodeMark(node, config) {
    const highlight = (config.highlight || []).indexOf(node.symbol) !== -1;
    const classes = 'tree-node' + (node.leaf ? ' tree-node-leaf' : '') +
      (highlight ? ' tree-node-active' : '');

    return '<g class="' + classes + '">' +
      '<rect x="' + round(node.x - width(node) / 2) + '" y="' + (node.y - 13) +
      '" width="' + width(node) + '" height="22" rx="5" />' +
      '<text x="' + round(node.x) + '" y="' + (node.y + 3) +
      '" text-anchor="middle">' + escapeText(node.symbol) + '</text></g>';
  }

  function width(node) {
    return Math.max(22, node.symbol.length * 8 + 10);
  }

  function round(value) { return Math.round(value * 10) / 10; }

  /* ---------------------------------------------------------------- forest */

  /**
   * A shared packed parse forest as a levelled DAG: one box per (symbol, span),
   * ambiguous ones marked, edges from each packing to its children. Nodes are
   * placed by span so the picture reads left to right like the input.
   */
  function forestMarkup(config) {
    const rows = groupBySpan(config.forest);

    if (rows.length === 0) return empty(config, 'empty forest');
    const size = { width: Math.max(320, (config.tokens || 8) * 64 + 80),
      height: rows.length * 44 + 30 };
    const placed = placeForest(rows, size, config.tokens || 8);

    return open(size, config.ariaLabel || 'parse forest') +
      placed.edges.map(function (edge) {
        return '<line x1="' + round(edge.x1) + '" y1="' + round(edge.y1) + '" x2="' +
          round(edge.x2) + '" y2="' + round(edge.y2) + '" class="tree-edge" />';
      }).join('') +
      placed.nodes.map(forestBox).join('') + '</svg>';
  }

  function groupBySpan(forest) {
    const rows = {};

    forest.forEach(function (node) {
      const length = node.to - node.from;

      if (!rows[length]) rows[length] = [];
      rows[length].push(node);
    });
    return Object.keys(rows).map(Number).sort(function (a, b) { return a - b; })
      .map(function (length) { return rows[length]; });
  }

  function placeForest(rows, size, tokens) {
    const nodes = [];
    const byKey = {};
    const unit = (size.width - 60) / Math.max(1, tokens);

    rows.forEach(function (row, level) {
      const y = size.height - level * 44 - 24;

      row.forEach(function (node) {
        const entry = { node: node, y: y,
          x: 30 + ((node.from + node.to) / 2) * unit,
          ambiguous: node.derivations > 1 };

        nodes.push(entry);
        byKey[node.symbol + ':' + node.from + ':' + node.to] = entry;
      });
    });
    return { nodes: nodes, edges: forestEdges(nodes, byKey) };
  }

  function forestEdges(nodes, byKey) {
    const edges = [];

    nodes.forEach(function (entry) {
      (entry.node.children || []).forEach(function (childKey) {
        const child = byKey[childKey];

        if (!child) return;
        edges.push({ x1: entry.x, y1: entry.y + 9, x2: child.x, y2: child.y - 13 });
      });
    });
    return edges;
  }

  function forestBox(entry) {
    const text = entry.node.symbol + ' ' + entry.node.from + '–' + entry.node.to;
    const boxWidth = Math.max(46, text.length * 7 + 10);

    return '<g class="tree-node' + (entry.ambiguous ? ' tree-node-active' : '') + '">' +
      '<rect x="' + round(entry.x - boxWidth / 2) + '" y="' + (entry.y - 13) +
      '" width="' + boxWidth + '" height="22" rx="5" />' +
      '<text x="' + round(entry.x) + '" y="' + (entry.y + 3) +
      '" text-anchor="middle">' + escapeText(text) +
      (entry.ambiguous ? ' ×' + entry.node.derivations : '') + '</text></g>';
  }

  function render(host, config) {
    if (!host) return null;
    host.innerHTML = config.forest ? forestMarkup(config) : markup(config);
    return { host: host };
  }

  return {
    markup: markup, forestMarkup: forestMarkup, render: render, layout: layout,
    LEAF_GAP: LEAF_GAP, LEVEL_GAP: LEVEL_GAP, MAX_LEAVES: MAX_LEAVES
  };
}));

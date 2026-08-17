/**
 * The call stack, made explicit.
 *
 * A recursive traversal and its explicit-stack equivalent, both instrumented,
 * so the frame depth is a number and "recursion is elegant until the frame
 * budget runs out" is a measurement. The frame layout here is the same shape
 * M39 formalises as a calling convention.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CallStack = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const FRAME_BYTES = 96;

  /** A binary tree as a flat array of {value, left, right}; -1 means absent. */
  function buildTree(options) {
    const settings = options || {};
    const count = settings.count || 15;
    const shape = settings.shape || 'balanced';
    const nodes = [];

    for (let i = 0; i < count; i += 1) nodes.push({ value: i, left: -1, right: -1 });

    if (shape === 'balanced') {
      for (let i = 0; i < count; i += 1) {
        if (2 * i + 1 < count) nodes[i].left = 2 * i + 1;
        if (2 * i + 2 < count) nodes[i].right = 2 * i + 2;
      }
      return { nodes: nodes, root: count ? 0 : -1, shape: shape };
    }

    // Degenerate: a linked list wearing a tree's clothes, which is the case
    // that overflows the stack.
    for (let i = 0; i + 1 < count; i += 1) nodes[i].right = i + 1;
    return { nodes: nodes, root: count ? 0 : -1, shape: shape };
  }

  /** Recursive in-order traversal, recording the frame stack over time. */
  function recursiveInOrder(tree, options) {
    const settings = options || {};
    const limit = settings.maxDepth || 100000;
    const visited = [];
    const timeline = [];
    let depth = 0;
    let peak = 0;
    let overflowed = false;

    function visit(index) {
      if (index < 0 || overflowed) return;
      if (depth + 1 > limit) { overflowed = true; return; }

      depth += 1;
      peak = Math.max(peak, depth);
      timeline.push({ depth: depth, node: index, op: 'enter' });

      visit(tree.nodes[index].left);
      visited.push(tree.nodes[index].value);
      visit(tree.nodes[index].right);

      timeline.push({ depth: depth, node: index, op: 'return' });
      depth -= 1;
    }

    visit(tree.root);

    return {
      order: visited,
      peakDepth: peak,
      peakBytes: peak * FRAME_BYTES,
      frames: timeline.length,
      overflowed: overflowed,
      timeline: timeline.slice(0, 400)
    };
  }

  /** The same traversal with an explicit stack: identical order, bounded heap. */
  function iterativeInOrder(tree) {
    const visited = [];
    const stack = [];
    const timeline = [];
    let cursor = tree.root;
    let peak = 0;

    while (cursor >= 0 || stack.length) {
      while (cursor >= 0) {
        stack.push(cursor);
        peak = Math.max(peak, stack.length);
        timeline.push({ depth: stack.length, node: cursor, op: 'push' });
        cursor = tree.nodes[cursor].left;
      }
      const index = stack.pop();
      timeline.push({ depth: stack.length + 1, node: index, op: 'pop' });
      visited.push(tree.nodes[index].value);
      cursor = tree.nodes[index].right;
    }

    return {
      order: visited,
      peakDepth: peak,
      peakBytes: peak * 8,          // one index per entry, not a whole frame
      frames: timeline.length,
      overflowed: false,
      timeline: timeline.slice(0, 400)
    };
  }

  /**
   * Measures the real engine's recursion limit by recursing until it throws.
   * The number is machine- and engine-specific, which is exactly the point.
   */
  function measureStackLimit() {
    let depth = 0;
    function descend() {
      depth += 1;
      descend();
    }
    try {
      descend();
    } catch (error) {
      return { depth: depth, error: error.name };
    }
    return { depth: depth, error: null };
  }

  function compare(options) {
    const tree = buildTree(options);
    const recursive = recursiveInOrder(tree, options);
    const iterative = iterativeInOrder(tree);

    return {
      tree: tree,
      recursive: recursive,
      iterative: iterative,
      sameOrder: recursive.order.join(',') === iterative.order.join(','),
      depthRatio: iterative.peakDepth ? recursive.peakDepth / iterative.peakDepth : 1
    };
  }

  return {
    buildTree: buildTree,
    recursiveInOrder: recursiveInOrder,
    iterativeInOrder: iterativeInOrder,
    measureStackLimit: measureStackLimit,
    compare: compare,
    FRAME_BYTES: FRAME_BYTES
  };
}));

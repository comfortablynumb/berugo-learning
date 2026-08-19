/**
 * Zippers: a focused position inside an immutable structure, plus enough
 * context to walk back out.
 *
 * The insight is that "a tree with a hole in it" is a *derivative* in the
 * literal sense - the type of one-hole contexts for a data type is its formal
 * derivative - and that the context can be represented as a stack of crumbs,
 * each holding a parent's value and the siblings on either side of the path.
 *
 * What that buys is the thing a mutable cursor gives you and an immutable
 * structure normally does not: moving and editing are O(1), not O(depth). A
 * naive "update the node at this path" rebuilds the path on *every* edit; a
 * zipper rebuilds it once, when you finally ask for the root. Ten edits under
 * one subtree cost ten O(1) writes and one O(depth) rebuild rather than ten
 * O(depth) rebuilds, and `nodesRebuilt` counts exactly that.
 *
 * This is what editors, DOM cursors and lens libraries are: a lens is the
 * general case of the same idea, and `up`/`down` are its composition.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Zipper = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyStats() {
    return { moves: 0, edits: 0, nodesRebuilt: 0, rebuilds: 0 };
  }

  function node(value, children) {
    return { value: value, children: children || [] };
  }

  /* --------------------------------------------------------- tree zipper */

  function tree(options) {
    const settings = options || {};
    let stats = emptyStats();

    /** A zipper is the focused subtree plus a stack of crumbs. Each crumb
     *  remembers the parent's value and the siblings to the left (reversed, so
     *  the nearest is at the head) and to the right. */
    function focus(subtree) {
      return { node: subtree, crumbs: [] };
    }

    function down(zipper, index) {
      const at = index || 0;
      const children = zipper.node.children;
      if (at < 0 || at >= children.length) return null;
      stats.moves += 1;
      return {
        node: children[at],
        crumbs: [{
          value: zipper.node.value,
          left: children.slice(0, at).reverse(),
          right: children.slice(at + 1)
        }].concat(zipper.crumbs)
      };
    }

    function up(zipper) {
      if (!zipper.crumbs.length) return null;
      stats.moves += 1;
      stats.nodesRebuilt += 1;
      const crumb = zipper.crumbs[0];
      return {
        node: node(crumb.value, crumb.left.slice().reverse().concat([zipper.node]).concat(crumb.right)),
        crumbs: zipper.crumbs.slice(1)
      };
    }

    function left(zipper) {
      const crumb = zipper.crumbs[0];
      if (!crumb || !crumb.left.length) return null;
      stats.moves += 1;
      return {
        node: crumb.left[0],
        crumbs: [{
          value: crumb.value,
          left: crumb.left.slice(1),
          right: [zipper.node].concat(crumb.right)
        }].concat(zipper.crumbs.slice(1))
      };
    }

    function right(zipper) {
      const crumb = zipper.crumbs[0];
      if (!crumb || !crumb.right.length) return null;
      stats.moves += 1;
      return {
        node: crumb.right[0],
        crumbs: [{
          value: crumb.value,
          left: [zipper.node].concat(crumb.left),
          right: crumb.right.slice(1)
        }].concat(zipper.crumbs.slice(1))
      };
    }

    /** The point of the whole structure: an edit here touches one object. */
    function replace(zipper, subtree) {
      stats.edits += 1;
      return { node: subtree, crumbs: zipper.crumbs };
    }

    function edit(zipper, fn) {
      return replace(zipper, node(fn(zipper.node.value), zipper.node.children));
    }

    function toRoot(zipper) {
      stats.rebuilds += 1;
      let current = zipper;
      let parent = up(current);
      while (parent) { current = parent; parent = up(current); }
      return current.node;
    }

    function depth(zipper) {
      return zipper.crumbs.length;
    }

    /** A path of child indices from the root, for drawing where the focus is. */
    function path(zipper) {
      return zipper.crumbs.map(function (crumb) { return crumb.left.length; }).reverse();
    }

    return {
      kind: 'tree',
      node: node,
      focus: focus,
      down: down,
      up: up,
      left: left,
      right: right,
      replace: replace,
      edit: edit,
      toRoot: toRoot,
      depth: depth,
      path: path,
      value: function (zipper) { return zipper.node.value; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); },
      label: settings.label || 'tree zipper'
    };
  }

  /* --------------------------------------------------------- list zipper */

  /**
   * The same idea one dimension down, and the one people write without
   * knowing its name: `before` reversed, the focus, and `after`. A text
   * editor's gap buffer is this with arrays instead of lists.
   */
  function list(options) {
    const settings = options || {};
    let stats = emptyStats();

    function focus(items, at) {
      const index = at || 0;
      return { before: items.slice(0, index).reverse(), node: items[index], after: items.slice(index + 1) };
    }

    function forward(zipper) {
      if (!zipper.after.length) return null;
      stats.moves += 1;
      return {
        before: [zipper.node].concat(zipper.before),
        node: zipper.after[0],
        after: zipper.after.slice(1)
      };
    }

    function back(zipper) {
      if (!zipper.before.length) return null;
      stats.moves += 1;
      return {
        before: zipper.before.slice(1),
        node: zipper.before[0],
        after: [zipper.node].concat(zipper.after)
      };
    }

    function replace(zipper, value) {
      stats.edits += 1;
      return { before: zipper.before, node: value, after: zipper.after };
    }

    function toArray(zipper) {
      stats.rebuilds += 1;
      return zipper.before.slice().reverse().concat([zipper.node]).concat(zipper.after);
    }

    return {
      kind: 'list',
      focus: focus,
      forward: forward,
      back: back,
      replace: replace,
      toArray: toArray,
      position: function (zipper) { return zipper.before.length; },
      value: function (zipper) { return zipper.node; },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); },
      label: settings.label || 'list zipper'
    };
  }

  /**
   * The comparison the section is for: N edits scattered under one subtree,
   * done with a zipper and done by rebuilding the path every time.
   *
   * The zipper is not a different algorithm - it is the same edits with the
   * rebuild deferred - so the answers are identical and only the node count
   * moves.
   */
  function editCost(options) {
    const settings = options || {};
    const engine = tree();
    const depth = Math.max(1, Math.floor(settings.depth || 8));
    const edits = Math.max(1, Math.floor(settings.edits || 50));

    function build(level) {
      if (level === 0) return node(level, []);
      return node(level, [build(level - 1), node(-level, [])]);
    }

    const source = build(depth);

    engine.resetStats();
    let zipper = engine.focus(source);
    for (let i = 0; i < depth; i += 1) zipper = engine.down(zipper, 0) || zipper;
    for (let i = 0; i < edits; i += 1) zipper = engine.edit(zipper, function (value) { return value + 1; });
    engine.toRoot(zipper);
    const withZipper = engine.stats();

    engine.resetStats();
    for (let i = 0; i < edits; i += 1) {
      let each = engine.focus(source);
      for (let d = 0; d < depth; d += 1) each = engine.down(each, 0) || each;
      each = engine.edit(each, function (value) { return value + 1; });
      engine.toRoot(each);
    }
    const withoutZipper = engine.stats();

    return {
      depth: depth,
      edits: edits,
      zipper: { nodesRebuilt: withZipper.nodesRebuilt, moves: withZipper.moves, rebuilds: withZipper.rebuilds },
      pathCopying: { nodesRebuilt: withoutZipper.nodesRebuilt, moves: withoutZipper.moves, rebuilds: withoutZipper.rebuilds },
      ratio: withZipper.nodesRebuilt ? withoutZipper.nodesRebuilt / withZipper.nodesRebuilt : Infinity
    };
  }

  return { tree: tree, list: list, node: node, editCost: editCost };
}));

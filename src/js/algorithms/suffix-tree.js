/**
 * Ukkonen's online suffix tree: every suffix of the text, in a compressed
 * trie, built left to right in linear time.
 *
 * The naive suffix trie is quadratic - `aaaa…a` of length n has n(n+1)/2
 * nodes - and the compressed version is linear in nodes but still quadratic to
 * build if each suffix is inserted from the root. Ukkonen's construction fixes
 * both with three ideas that only make sense together:
 *
 *   - **Open edges.** A leaf's end index is a shared "current position", so
 *     extending the text extends every leaf for free. Rule 1 costs nothing.
 *   - **The active point** (node, edge, length) remembers where the last
 *     insertion happened, so the next one starts there rather than at the root.
 *   - **Suffix links.** After splitting at some point in suffix i, the same
 *     point in suffix i + 1 is one link away, so the walk down is not repeated.
 *
 * `remainder` counts the suffixes still owed. Each phase adds one character,
 * increments the remainder, and pays it down: rule 2 (split an edge, make a
 * leaf) reduces it by one, rule 3 (the character is already there) stops the
 * phase and leaves the tree *implicit* - a suffix that ends inside an edge has
 * no leaf yet. A unique terminator makes every suffix end at a leaf, which is
 * why `$` is appended and why the section is careful that the terminator must
 * not occur in the text.
 *
 * The tree is the theoretician's structure: linear time, linear space, and a
 * measured 1.5-2.0 nodes per character, which under the byte model below is
 * 35-48 bytes per character against the suffix array's 9. That constant, not
 * the asymptotics, is why bioinformatics switched.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SuffixTree = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Per-node cost under a stated model, because a JS heap cannot be measured
     from inside the language: four 4-byte fields (start, end, suffix link,
     parent) plus one 8-byte child-map entry = 24 bytes. The node count is
     measured, so bytes-per-character follows from the tree rather than from a
     quoted constant. Kurtz's heavily engineered implementation reaches about
     20 bytes per input character; a straightforward one lands near 40, which
     is the figure that made everyone switch to suffix arrays. */
  const BYTES_PER_NODE = 24;

  /* A leaf's end index. Shared by the construction (where "the current
     position" makes rule 1 free) and by every reader below. */
  const OPEN = Infinity;

  function newStats() {
    return {
      phases: 0, extensions: 0, rule1: 0, rule2: 0, rule3: 0,
      splits: 0, suffixLinks: 0, walkDowns: 0, nodesCreated: 0
    };
  }

  /** Ukkonen's construction, on its own so `build` below is only the query
   *  surface. Returns the root plus the state a reader would want to see:
   *  the remainder must be zero at the end, or a suffix was never inserted. */
  function construct(text, stats, trace) {
    let nextId = 0;

    function newNode(start, end) {
      stats.nodesCreated += 1;
      nextId += 1;
      return { id: nextId, start: start, end: end, children: new Map(), link: null };
    }

    const rootNode = newNode(-1, -1);
    rootNode.id = 0;
    nextId = 0;
    stats.nodesCreated = 0;

    let position = -1;
    let remainder = 0;
    let activeNode = rootNode;
    let activeEdge = -1;
    let activeLength = 0;
    let needsLink = null;

    function edgeLength(node) {
      return Math.min(node.end === OPEN ? position + 1 : node.end, position + 1) - node.start;
    }

    function addLink(node) {
      if (needsLink) { needsLink.link = node; stats.suffixLinks += 1; }
      needsLink = node;
    }

    /** Skip/count: if the active length runs past the active edge, hop to the
     *  child and keep going. Without this the walk is O(length) per extension
     *  and the construction is quadratic again. */
    function walkDown(next) {
      if (activeLength < edgeLength(next)) return false;
      stats.walkDowns += 1;
      activeEdge += edgeLength(next);
      activeLength -= edgeLength(next);
      activeNode = next;
      return true;
    }

    function extend() {
      position += 1;
      stats.phases += 1;
      remainder += 1;
      needsLink = null;

      while (remainder > 0) {
        stats.extensions += 1;
        if (activeLength === 0) activeEdge = position;

        const symbol = text[activeEdge];
        let next = activeNode.children.get(symbol);

        if (!next) {
          /* Rule 2 at a node: a new leaf hangs directly off the active node. */
          stats.rule2 += 1;
          activeNode.children.set(symbol, newNode(position, OPEN));
          addLink(activeNode);
        } else {
          if (walkDown(next)) continue;

          if (text[next.start + activeLength] === text[position]) {
            /* Rule 3: the character is already on the edge. The phase ends and
               the tree stays implicit - this is where the remainder builds up. */
            stats.rule3 += 1;
            activeLength += 1;
            addLink(activeNode);
            break;
          }

          /* Rule 2 inside an edge: split it. */
          stats.rule2 += 1;
          stats.splits += 1;
          const split = newNode(next.start, next.start + activeLength);
          activeNode.children.set(symbol, split);
          split.children.set(text[position], newNode(position, OPEN));
          next.start += activeLength;
          split.children.set(text[next.start], next);
          addLink(split);
        }

        remainder -= 1;

        if (activeNode === rootNode && activeLength > 0) {
          activeLength -= 1;
          activeEdge = position - remainder + 1;
        } else {
          activeNode = activeNode.link || rootNode;
        }
      }

      if (trace) {
        trace.push({
          phase: stats.phases, added: text[position], remainder: remainder,
          activeNode: activeNode.id, activeEdge: activeEdge, activeLength: activeLength,
          nodes: stats.nodesCreated + 1
        });
      }
    }

    for (let i = 0; i < text.length; i += 1) extend();
    return { root: rootNode, remainder: remainder, position: position, edgeLength: edgeLength };
  }

  function build(input, options) {
    const settings = options || {};
    const terminator = settings.terminator || '$';
    if (input.indexOf(terminator) !== -1) {
      throw new Error('suffix-tree: the terminator "' + terminator + '" occurs in the text');
    }

    const text = input + terminator;
    const stats = newStats();
    const trace = settings.trace ? [] : null;
    const built = construct(text, stats, trace);
    const rootNode = built.root;
    const edgeLength = built.edgeLength;
    const remainder = built.remainder;

    /* ------------------------------------------------------- inspection */

    function labelOf(node) {
      if (node === rootNode) return '';
      const end = node.end === OPEN ? text.length : node.end;
      return text.slice(node.start, end);
    }

    function walk(visit) {
      const stack = [{ node: rootNode, depth: 0, text: '' }];
      while (stack.length) {
        const item = stack.pop();
        visit(item);
        item.node.children.forEach(function (child) {
          stack.push({ node: child, depth: item.depth + 1, text: item.text + labelOf(child) });
        });
      }
    }

    function nodes() {
      let total = 0;
      walk(function () { total += 1; });
      return total;
    }

    function leaves() {
      let total = 0;
      walk(function (item) { if (!item.node.children.size) total += 1; });
      return total;
    }

    /** Does `pattern` occur? One walk down, O(m), whatever the text length. */
    function has(pattern) {
      if (!pattern.length) return true;
      let node = rootNode;
      let at = 0;

      while (at < pattern.length) {
        const child = node.children.get(pattern[at]);
        if (!child) return false;
        const label = labelOf(child);
        for (let i = 0; i < label.length && at < pattern.length; i += 1, at += 1) {
          if (label[i] !== pattern[at]) return false;
        }
        node = child;
      }
      return true;
    }

    /** How many times it occurs: the number of leaves below the match point. */
    function countOccurrences(pattern) {
      if (!pattern.length) return 0;
      let node = rootNode;
      let at = 0;

      while (at < pattern.length) {
        const child = node.children.get(pattern[at]);
        if (!child) return 0;
        const label = labelOf(child);
        for (let i = 0; i < label.length && at < pattern.length; i += 1, at += 1) {
          if (label[i] !== pattern[at]) return 0;
        }
        node = child;
      }

      let count = 0;
      const stack = [node];
      while (stack.length) {
        const current = stack.pop();
        if (!current.children.size) { count += 1; continue; }
        current.children.forEach(function (child) { stack.push(child); });
      }
      return count;
    }

    /** The deepest internal node's path label: the longest substring that
     *  occurs at least twice. The terminator's own branch is excluded. */
    function longestRepeated() {
      let best = '';
      walk(function (item) {
        if (!item.node.children.size) return;
        const spelled = item.text;
        if (spelled.indexOf(terminator) !== -1) return;
        if (spelled.length > best.length) best = spelled;
      });
      return best;
    }

    function checkInvariants() {
      const errors = [];
      let leafCount = 0;

      walk(function (item) {
        const node = item.node;
        if (node === rootNode) return;
        if (edgeLength(node) <= 0) errors.push('node ' + node.id + ' carries an empty edge');
        if (!node.children.size) leafCount += 1;
        else if (node.children.size === 1) errors.push('node ' + node.id + ' branches once: the edge was not compressed');
        node.children.forEach(function (child, symbol) {
          if (text[child.start] !== symbol) {
            errors.push('node ' + node.id + ' files an edge starting "' + text[child.start] + '" under "' + symbol + '"');
          }
        });
      });

      /* With a unique terminator every suffix ends at its own leaf. */
      if (leafCount !== text.length) {
        errors.push('the tree has ' + leafCount + ' leaves for ' + text.length + ' suffixes');
      }
      if (remainder !== 0) errors.push('the construction ended owing ' + remainder + ' suffixes');
      return { ok: errors.length === 0, errors: errors.slice(0, 5) };
    }

    /** Suffix start positions, read off the leaves - the suffix array, built
     *  the expensive way, and the check that the tree is the same object the
     *  array is. */
    function suffixArray() {
      const out = [];
      const visit = function (node, depth) {
        if (!node.children.size) { out.push(text.length - depth); return; }
        Array.from(node.children.keys()).sort().forEach(function (symbol) {
          const child = node.children.get(symbol);
          visit(child, depth + labelOf(child).length);
        });
      };
      visit(rootNode, 0);
      return out.slice(1);
    }

    function publicApi() {
      return {
        name: 'suffix-tree',
        text: text,
        terminator: terminator,
        root: function () { return rootNode; },
        labelOf: labelOf,
        walk: walk,
        nodes: nodes,
        leaves: leaves,
        has: has,
        countOccurrences: countOccurrences,
        longestRepeated: longestRepeated,
        suffixArray: suffixArray,
        trace: trace || [],
        bytes: function () { return nodes() * BYTES_PER_NODE; },
        bytesPerChar: function () { return nodes() * BYTES_PER_NODE / input.length; },
        checkInvariants: checkInvariants,
        stats: function () { return Object.assign({ length: text.length, nodes: nodes() }, stats); }
      };
    }

    return publicApi();
  }

  return { build: build, newStats: newStats, BYTES_PER_NODE: BYTES_PER_NODE };
}));

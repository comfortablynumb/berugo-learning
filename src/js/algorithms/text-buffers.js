/**
 * Editor text structures: gap buffer, piece table and a rope.
 *
 * All three answer the same question - where do you put the text so that the
 * edits people actually make are cheap - and they answer it differently. Each
 * reports the bytes it moved and the nodes it allocated, so the comparison in
 * the section is measured rather than argued.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.TextBuffers = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* --------------------------------------------------------------- gap buffer */

  /**
   * A gap buffer keeps free space at the cursor: typing there is free, and
   * moving the cursor costs the distance moved. That is exactly the trade an
   * editor wants for sequential typing and the wrong one for scattered edits.
   */
  function createGapBuffer(options) {
    const settings = options || {};
    const initialGap = settings.gap || 16;
    let chars = new Array(initialGap).fill('');
    let gapStart = 0;
    let gapEnd = initialGap;
    const stats = { moved: 0, grows: 0, inserts: 0, deletes: 0 };

    function text() {
      return chars.slice(0, gapStart).join('') + chars.slice(gapEnd).join('');
    }

    function length() {
      return chars.length - (gapEnd - gapStart);
    }

    function moveGap(position) {
      while (gapStart > position) {
        gapStart -= 1;
        gapEnd -= 1;
        chars[gapEnd] = chars[gapStart];
        stats.moved += 1;
      }
      while (gapStart < position) {
        chars[gapStart] = chars[gapEnd];
        gapStart += 1;
        gapEnd += 1;
        stats.moved += 1;
      }
    }

    function grow(extra) {
      const needed = Math.max(extra, chars.length);
      const before = chars.slice(0, gapStart);
      const after = chars.slice(gapEnd);
      chars = before.concat(new Array(needed).fill(''), after);
      gapEnd = gapStart + needed;
      stats.grows += 1;
      stats.moved += after.length;
    }

    function insert(position, value) {
      moveGap(position);
      if (gapEnd - gapStart < value.length) grow(value.length);
      for (let i = 0; i < value.length; i += 1) {
        chars[gapStart] = value[i];
        gapStart += 1;
      }
      stats.inserts += 1;
      return length();
    }

    function remove(position, count) {
      moveGap(position + count);
      const removed = Math.min(count, gapStart);
      gapStart -= removed;
      stats.deletes += 1;
      return removed;
    }

    return {
      insert: insert, remove: remove, text: text, length: length,
      stats: function () { return Object.assign({}, stats); },
      gap: function () { return { start: gapStart, end: gapEnd, size: gapEnd - gapStart }; }
    };
  }

  /* --------------------------------------------------------------- piece table */

  /**
   * A piece table never moves text: the original buffer is immutable, added
   * text is appended to a second buffer, and the document is a list of pieces
   * pointing into the two. Edits cost list surgery, not byte movement - which
   * is why VS Code moved to one.
   */
  function createPieceTable(original) {
    const buffers = { original: original || '', added: '' };
    let pieces = original ? [{ buffer: 'original', start: 0, length: original.length }] : [];
    const stats = { moved: 0, pieces: pieces.length, inserts: 0, deletes: 0 };

    function text() {
      return pieces.map(function (piece) {
        return buffers[piece.buffer].substr(piece.start, piece.length);
      }).join('');
    }

    function length() {
      return pieces.reduce(function (sum, piece) { return sum + piece.length; }, 0);
    }

    /** Splits the piece list at a document offset, returning the piece index. */
    function splitAt(offset) {
      let seen = 0;
      for (let i = 0; i < pieces.length; i += 1) {
        const piece = pieces[i];
        if (offset === seen) return i;
        if (offset < seen + piece.length) {
          const head = { buffer: piece.buffer, start: piece.start, length: offset - seen };
          const tail = {
            buffer: piece.buffer,
            start: piece.start + (offset - seen),
            length: piece.length - (offset - seen)
          };
          pieces.splice(i, 1, head, tail);
          return i + 1;
        }
        seen += piece.length;
      }
      return pieces.length;
    }

    function insert(offset, value) {
      const index = splitAt(offset);
      const start = buffers.added.length;
      buffers.added += value;
      pieces.splice(index, 0, { buffer: 'added', start: start, length: value.length });
      stats.inserts += 1;
      stats.pieces = pieces.length;
      return length();
    }

    function remove(offset, count) {
      const from = splitAt(offset);
      const to = splitAt(offset + count);
      pieces.splice(from, to - from);
      stats.deletes += 1;
      stats.pieces = pieces.length;
      return count;
    }

    return {
      insert: insert, remove: remove, text: text, length: length,
      stats: function () { return Object.assign({}, stats); },
      pieces: function () { return pieces.slice(); }
    };
  }

  /* --------------------------------------------------------------------- rope */

  /**
   * A rope is a balanced tree of string leaves: concatenation and split are
   * O(log n) and never copy the whole document, which is what makes a large
   * paste cheap.
   */
  function createRope(text, leafSize) {
    const limit = leafSize || 64;
    const stats = { splits: 0, joins: 0, copied: 0, rebuilds: 0 };

    function leaf(value) {
      return { text: value, length: value.length, height: 1 };
    }

    function join(left, right) {
      if (!left) return right;
      if (!right) return left;
      stats.joins += 1;
      if (left.text !== undefined && right.text !== undefined && left.length + right.length <= limit) {
        stats.copied += left.length + right.length;
        return leaf(left.text + right.text);
      }
      return {
        left: left, right: right,
        length: left.length + right.length,
        height: Math.max(left.height, right.height) + 1
      };
    }

    function split(node, offset) {
      stats.splits += 1;
      if (!node) return [null, null];
      if (node.text !== undefined) {
        stats.copied += node.length;
        return [
          offset > 0 ? leaf(node.text.slice(0, offset)) : null,
          offset < node.length ? leaf(node.text.slice(offset)) : null
        ];
      }
      if (offset < node.left.length) {
        const parts = split(node.left, offset);
        return [parts[0], join(parts[1], node.right)];
      }
      const parts = split(node.right, offset - node.left.length);
      return [join(node.left, parts[0]), parts[1]];
    }

    let rootNode = text ? leaf(text) : null;
    while (rootNode && rootNode.text !== undefined && rootNode.length > limit) {
      const parts = split(rootNode, Math.floor(rootNode.length / 2));
      rootNode = { left: parts[0], right: parts[1], length: rootNode.length, height: 2 };
    }

    function toString(node) {
      const target = node === undefined ? rootNode : node;
      if (!target) return '';
      if (target.text !== undefined) return target.text;
      return toString(target.left) + toString(target.right);
    }

    function collectLeaves(node, out) {
      if (!node) return out;
      if (node.text !== undefined) { out.push(node.text); return out; }
      collectLeaves(node.left, out);
      collectLeaves(node.right, out);
      return out;
    }

    function buildBalanced(parts) {
      if (!parts.length) return null;
      if (parts.length === 1) return leaf(parts[0]);
      const mid = Math.floor(parts.length / 2);
      const left = buildBalanced(parts.slice(0, mid));
      const right = buildBalanced(parts.slice(mid));
      return {
        left: left, right: right,
        length: left.length + right.length,
        height: Math.max(left.height, right.height) + 1
      };
    }

    /**
     * Appending always to one end grows a spine, and a spine is a linked list
     * with extra steps. The height is already tracked, so the check is O(1)
     * and the O(n) rebuild only runs when the tree has drifted well past the
     * balanced height - which is what keeps split and concat logarithmic.
     */
    function rebalanceIfNeeded() {
      if (!rootNode || rootNode.text !== undefined) return;
      const ideal = Math.ceil(Math.log2(Math.max(2, rootNode.length / limit + 1)));
      if (rootNode.height <= 3 * ideal + 4) return;
      rootNode = buildBalanced(collectLeaves(rootNode, []));
      stats.rebuilds += 1;
    }

    return {
      insert: function (offset, value) {
        const parts = split(rootNode, offset);
        rootNode = join(join(parts[0], leaf(value)), parts[1]);
        rebalanceIfNeeded();
        return rootNode.length;
      },
      remove: function (offset, count) {
        const first = split(rootNode, offset);
        const second = split(first[1], count);
        rootNode = join(first[0], second[1]);
        rebalanceIfNeeded();
        return count;
      },
      text: function () { return toString(); },
      length: function () { return rootNode ? rootNode.length : 0; },
      height: function () { return rootNode ? rootNode.height : 0; },
      stats: function () { return Object.assign({}, stats); }
    };
  }

  /**
   * Replays one edit script against all three structures and reports what each
   * one had to move. Sequential typing favours the gap buffer; scattered edits
   * after a large paste favour the piece table.
   */
  function compare(options) {
    const script = options.script;
    const initial = options.initial || '';

    const gap = createGapBuffer({ gap: 32 });
    if (initial) gap.insert(0, initial);
    const piece = createPieceTable(initial);
    const rope = createRope(initial, options.leafSize || 64);

    script.forEach(function (edit) {
      if (edit.op === 'insert') {
        gap.insert(edit.at, edit.text);
        piece.insert(edit.at, edit.text);
        rope.insert(edit.at, edit.text);
      } else {
        gap.remove(edit.at, edit.count);
        piece.remove(edit.at, edit.count);
        rope.remove(edit.at, edit.count);
      }
    });

    return {
      agree: gap.text() === piece.text() && piece.text() === rope.text(),
      text: piece.text(),
      gap: gap.stats(),
      piece: piece.stats(),
      rope: rope.stats()
    };
  }

  return {
    createGapBuffer: createGapBuffer,
    createPieceTable: createPieceTable,
    createRope: createRope,
    compare: compare
  };
}));

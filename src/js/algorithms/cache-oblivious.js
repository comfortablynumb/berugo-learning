/**
 * Optimal without knowing the cache, which is how a library gets good
 * behaviour on machines it was never tuned for.
 *
 * A cache-aware algorithm is handed B and M and blocks its work to fit. A
 * cache-oblivious one is handed neither and gets asymptotically the same miss
 * count anyway, by recursing until the subproblem is small — at some level of
 * the recursion the subproblem fits in the cache, whatever the cache is, and
 * every level below that is free. The tuned version wins at the size it was
 * tuned for; the oblivious one tracks near-optimal at every size, including
 * the ones nobody measured.
 *
 * Three algorithms make the point and they are ordered by how surprising they
 * are:
 *
 *   - **Transpose.** The row-major loop reads one matrix along rows and writes
 *     the other along columns, so one side misses on every element. Recursive
 *     subdivision makes both sides local.
 *   - **Matrix multiply.** The textbook triple loop is O(n³) work and O(n³)
 *     misses once the matrices exceed the cache; blocking makes it
 *     O(n³/(B·√M)), and recursive subdivision reaches the same bound with no
 *     parameter.
 *   - **The van Emde Boas layout.** A binary search over a sorted array costs
 *     log₂(n) − log₂(B) misses; the same tree laid out in vEB order costs
 *     log_B(n). That is the B-tree bound reached without knowing B.
 *
 * The tall-cache assumption is load-bearing and is stated rather than assumed:
 * the bounds need M = Ω(B²), and a cache that is wide and shallow breaks them.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CacheOblivious = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const CacheSim = scope && scope.CacheSim ? scope.CacheSim : require('../machines/cache-sim.js');

  /* ------------------------------------------------------- the measurement */

  /**
   * A matrix as a flat array with a base address, so a cache simulator sees
   * the same addresses the algorithm would generate. `elementBytes` is 8, the
   * width of a double, because a miss count is meaningless without the unit.
   */
  function matrix(n, base, elementBytes) {
    return { n: n, base: base === undefined ? 0 : base,
      bytes: elementBytes === undefined ? 8 : elementBytes,
      addressOf: function (row, col) {
        return (base === undefined ? 0 : base) + (row * n + col) *
          (elementBytes === undefined ? 8 : elementBytes);
      } };
  }

  function cacheFor(options) {
    const settings = options || {};

    return CacheSim.create({ lineBytes: settings.lineBytes === undefined ? 64 : settings.lineBytes,
      lines: settings.lines === undefined ? 512 : settings.lines });
  }

  /* ---------------------------------------------------------- transpose */

  /**
   * The three matrix arguments travel as one `{ a, b, c }` (or `{ from, to }`)
   * object rather than as separate parameters: the recursive helpers below
   * would otherwise need six or seven arguments each, and every one of them
   * passes the same matrices straight through.
   */

  /** The obvious loop: rows of the source, columns of the destination. */
  function transposeNaive(pair, cache) {
    for (let i = 0; i < pair.from.n; i += 1) {
      for (let j = 0; j < pair.from.n; j += 1) {
        touchPair(pair, cache, i, j);
      }
    }
    return { name: 'row-major loop', stats: cache.stats() };
  }

  function touchPair(pair, cache, i, j) {
    cache.access(pair.from.addressOf(i, j), pair.from.bytes);
    cache.access(pair.to.addressOf(j, i), pair.to.bytes);
  }

  /** Blocked by a tile the caller has to choose, which is the whole point. */
  function transposeTiled(pair, cache, tile) {
    const n = pair.from.n;

    for (let ii = 0; ii < n; ii += tile) {
      for (let jj = 0; jj < n; jj += tile) {
        for (let i = ii; i < Math.min(n, ii + tile); i += 1) {
          for (let j = jj; j < Math.min(n, jj + tile); j += 1) {
            touchPair(pair, cache, i, j);
          }
        }
      }
    }
    return { name: 'tiled (tile ' + tile + ')', stats: cache.stats(), tile: tile };
  }

  /**
   * Split the larger dimension and recurse. No parameter, no knowledge of the
   * cache, and at some depth the submatrix fits in whatever cache is there.
   */
  function transposeRecursive(pair, cache, options) {
    const settings = options || {};
    const state = { calls: 0, cutoff: settings.cutoff === undefined ? 1 : settings.cutoff };
    const n = pair.from.n;

    transposeBlock(pair, cache, { rowFrom: 0, rowTo: n, colFrom: 0, colTo: n }, state);
    return { name: 'recursive (cache-oblivious)', stats: cache.stats(), calls: state.calls };
  }

  function transposeBlock(pair, cache, span, state) {
    state.calls += 1;
    const rows = span.rowTo - span.rowFrom;
    const cols = span.colTo - span.colFrom;

    if (rows <= state.cutoff && cols <= state.cutoff) {
      for (let i = span.rowFrom; i < span.rowTo; i += 1) {
        for (let j = span.colFrom; j < span.colTo; j += 1) {
          touchPair(pair, cache, i, j);
        }
      }
      return;
    }
    if (rows >= cols) {
      const middle = span.rowFrom + (rows >> 1);

      transposeBlock(pair, cache, Object.assign({}, span, { rowTo: middle }), state);
      transposeBlock(pair, cache, Object.assign({}, span, { rowFrom: middle }), state);
      return;
    }
    const middle = span.colFrom + (cols >> 1);

    transposeBlock(pair, cache, Object.assign({}, span, { colTo: middle }), state);
    transposeBlock(pair, cache, Object.assign({}, span, { colFrom: middle }), state);
  }

  /* --------------------------------------------------------- multiply */

  function touchProduct(m, cache, at) {
    cache.access(m.a.addressOf(at.i, at.k), m.a.bytes);
    cache.access(m.b.addressOf(at.k, at.j), m.b.bytes);
    cache.access(m.c.addressOf(at.i, at.j), m.c.bytes);
  }

  function multiplyNaive(m, cache) {
    const n = m.a.n;

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        for (let k = 0; k < n; k += 1) touchProduct(m, cache, { i: i, j: j, k: k });
      }
    }
    return { name: 'triple loop', stats: cache.stats() };
  }

  function multiplyTiled(m, cache, tile) {
    const n = m.a.n;

    for (let ii = 0; ii < n; ii += tile) {
      for (let jj = 0; jj < n; jj += tile) {
        for (let kk = 0; kk < n; kk += tile) {
          tileProduct(m, cache, { ii: ii, jj: jj, kk: kk, tile: tile, n: n });
        }
      }
    }
    return { name: 'tiled (tile ' + tile + ')', stats: cache.stats(), tile: tile };
  }

  function tileProduct(m, cache, span) {
    for (let i = span.ii; i < Math.min(span.n, span.ii + span.tile); i += 1) {
      for (let j = span.jj; j < Math.min(span.n, span.jj + span.tile); j += 1) {
        for (let k = span.kk; k < Math.min(span.n, span.kk + span.tile); k += 1) {
          touchProduct(m, cache, { i: i, j: j, k: k });
        }
      }
    }
  }

  /** Halve every dimension and make eight recursive calls. Same work, and the
   *  blocking is implicit at every scale at once. */
  function multiplyRecursive(m, cache, options) {
    const settings = options || {};
    const state = { calls: 0, cutoff: settings.cutoff === undefined ? 8 : settings.cutoff };

    multiplyBlock(m, cache, { i: 0, j: 0, k: 0, size: m.a.n }, state);
    return { name: 'recursive (cache-oblivious)', stats: cache.stats(), calls: state.calls };
  }

  function multiplyBlock(m, cache, span, state) {
    state.calls += 1;
    if (span.size <= state.cutoff) { baseProduct(m, cache, span); return; }
    const half = span.size >> 1;

    [0, half].forEach(function (di) {
      [0, half].forEach(function (dj) {
        [0, half].forEach(function (dk) {
          multiplyBlock(m, cache,
            { i: span.i + di, j: span.j + dj, k: span.k + dk, size: half }, state);
        });
      });
    });
  }

  function baseProduct(m, cache, span) {
    for (let i = span.i; i < span.i + span.size; i += 1) {
      for (let j = span.j; j < span.j + span.size; j += 1) {
        for (let k = span.k; k < span.k + span.size; k += 1) {
          touchProduct(m, cache, { i: i, j: j, k: k });
        }
      }
    }
  }

  /* ------------------------------------------------- van Emde Boas layout */

  /**
   * A complete binary tree of `height` levels, laid out so that a subtree of
   * about √n nodes is contiguous. Split the height in half: the top √n tree
   * first, then each of its √n bottom subtrees in turn, recursively. A search
   * then touches O(log_B n) blocks without anybody having told it B.
   */
  function vebOrder(height) {
    const out = [];

    vebLayout(0, height, out);
    return out;
  }

  /**
   * The recursion has to walk HEAP indices, not offsets. A subtree of a
   * complete binary tree does not occupy a contiguous range of heap indices —
   * the subtree rooted at r holds r, 2r+1, 2r+2, 4r+3, … — so laying the
   * bottom trees out by adding a base offset produces a permutation that looks
   * like a layout and measures identically to level order, which is what the
   * first version of this function did.
   */
  function vebLayout(node, height, out) {
    if (height <= 0) return;
    if (height === 1) { out.push(node); return; }
    const topHeight = Math.ceil(height / 2);

    vebLayout(node, topHeight, out);
    bottomRoots(node, topHeight).forEach(function (root) {
      vebLayout(root, height - topHeight, out);
    });
  }

  /** The 2^depth nodes sitting `depth` levels below `node`. */
  function bottomRoots(node, depth) {
    let level = [node];

    for (let d = 0; d < depth; d += 1) {
      const next = [];
      level.forEach(function (v) { next.push(2 * v + 1); next.push(2 * v + 2); });
      level = next;
    }
    return level;
  }

  /** Map each heap index to its position in the chosen layout. */
  function layoutPositions(height, kind) {
    const size = Math.pow(2, height) - 1;
    const positions = new Array(size);

    if (kind === 'veb') {
      vebOrder(height).forEach(function (node, at) { positions[node] = at; });
      return positions;
    }
    if (kind === 'inorder') {
      const state = { at: 0 };
      inorderWalk(0, size, positions, state);
      return positions;
    }
    for (let i = 0; i < size; i += 1) positions[i] = i;
    return positions;
  }

  function inorderWalk(node, size, positions, state) {
    if (node >= size) return;
    inorderWalk(2 * node + 1, size, positions, state);
    positions[node] = state.at;
    state.at += 1;
    inorderWalk(2 * node + 2, size, positions, state);
  }

  /**
   * Walk from the root to a leaf, touching each node's address in the chosen
   * layout. The comparison count is identical for all three layouts — only
   * where the nodes sit changes, which is exactly the point.
   */
  function searchLayout(options) {
    const settings = options || {};
    const height = settings.height === undefined ? 14 : settings.height;
    const kind = settings.kind === undefined ? 'veb' : settings.kind;
    const positions = layoutPositions(height, kind);
    const cache = cacheFor(settings);
    const size = positions.length;
    const bytes = settings.elementBytes === undefined ? 8 : settings.elementBytes;
    const queries = settings.queries === undefined ? 2000 : settings.queries;
    let comparisons = 0;

    for (let q = 0; q < queries; q += 1) {
      let node = 0;
      let bit = (q * 2654435761) >>> 0;
      while (node < size) {
        cache.access(positions[node] * bytes, bytes);
        comparisons += 1;
        node = 2 * node + 1 + (bit & 1);
        bit >>>= 1;
        if (bit === 0) bit = ((q + 1) * 2654435761) >>> 0;
      }
    }
    return { kind: kind, height: height, nodes: size, queries: queries,
      comparisons: comparisons, stats: cache.stats(),
      missesPerQuery: cache.stats().misses / queries };
  }

  return {
    matrix: matrix, cacheFor: cacheFor,
    transposeNaive: transposeNaive, transposeTiled: transposeTiled,
    transposeRecursive: transposeRecursive,
    multiplyNaive: multiplyNaive, multiplyTiled: multiplyTiled,
    multiplyRecursive: multiplyRecursive,
    vebOrder: vebOrder, bottomRoots: bottomRoots,
    layoutPositions: layoutPositions, searchLayout: searchLayout
  };
}));

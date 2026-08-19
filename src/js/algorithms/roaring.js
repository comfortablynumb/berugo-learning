/**
 * Roaring bitmaps: a compressed set of 32-bit integers that is fast *because
 * of* its compression rather than in spite of it.
 *
 * The value space is cut into chunks of 2^16, and each chunk is stored in
 * whichever of three containers suits its contents:
 *
 *   array   a sorted list of 16-bit offsets. Best while the chunk is sparse;
 *           4 096 values is where 2 bytes each stops beating a flat bitmap.
 *   bitmap  65 536 bits, 8 KB flat. Constant size, constant-time membership,
 *           and the right answer once a chunk is dense.
 *   run     (start, length) pairs. Unbeatable on the long consecutive stretches
 *           that a sorted-id posting list is mostly made of.
 *
 * What made Roaring win was not the storage - run-length codings like WAH and
 * EWAH compress comparably - but that every *operation* has a path per pair of
 * container types, and none of them decompresses. An array intersected with a
 * bitmap probes the bitmap once per array element: the work is the size of the
 * smaller side, not the size of the universe. A WAH bitmap has to walk both
 * encodings in lockstep whatever the densities are, and `wordsTouched` is
 * where that difference shows up as a number.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Roaring = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CHUNK = 1 << 16;
  const ARRAY_MAX = 4096;

  function emptyStats() {
    return { operations: 0, wordsTouched: 0, elementsTouched: 0, probes: 0, conversions: 0 };
  }

  function create(options) {
    const settings = options || {};
    let stats = emptyStats();

    function arrayContainer(values) {
      return { kind: 'array', values: values || [] };
    }

    function bitmapContainer(words) {
      return { kind: 'bitmap', words: words || new Uint32Array(CHUNK / 32), count: 0 };
    }

    function runContainer(runs) {
      return { kind: 'run', runs: runs || [] };
    }

    function cardinality(container) {
      if (container.kind === 'array') return container.values.length;
      if (container.kind === 'bitmap') return container.count;
      return container.runs.reduce(function (total, run) { return total + run.length; }, 0);
    }

    function toArray(container) {
      if (container.kind === 'array') return container.values.slice();
      if (container.kind === 'run') {
        const out = [];
        container.runs.forEach(function (run) {
          for (let i = 0; i < run.length; i += 1) out.push(run.start + i);
        });
        return out;
      }
      const out = [];
      for (let word = 0; word < container.words.length; word += 1) {
        let bits = container.words[word];
        while (bits) {
          const lowest = bits & -bits;
          out.push(word * 32 + Math.log2(lowest >>> 0));
          bits = (bits ^ lowest) >>> 0;
        }
      }
      return out;
    }

    function has(container, offset) {
      if (container.kind === 'bitmap') {
        stats.probes += 1;
        return ((container.words[offset >>> 5] >>> (offset & 31)) & 1) === 1;
      }
      if (container.kind === 'run') {
        stats.elementsTouched += container.runs.length;
        return container.runs.some(function (run) {
          return offset >= run.start && offset < run.start + run.length;
        });
      }
      let low = 0;
      let high = container.values.length - 1;
      while (low <= high) {
        stats.probes += 1;
        const mid = (low + high) >> 1;
        if (container.values[mid] === offset) return true;
        if (container.values[mid] < offset) low = mid + 1;
        else high = mid - 1;
      }
      return false;
    }

    function promote(container) {
      /** The container-selection rule, which is the whole design in one place. */
      if (container.kind !== 'array' || container.values.length <= ARRAY_MAX) return container;
      stats.conversions += 1;
      const bitmap = bitmapContainer();
      container.values.forEach(function (offset) {
        bitmap.words[offset >>> 5] = (bitmap.words[offset >>> 5] | (1 << (offset & 31))) >>> 0;
      });
      bitmap.count = container.values.length;
      return bitmap;
    }

    function addTo(container, offset) {
      if (container.kind === 'bitmap') {
        const word = offset >>> 5;
        const bit = (1 << (offset & 31)) >>> 0;
        if (!(container.words[word] & bit)) { container.words[word] = (container.words[word] | bit) >>> 0; container.count += 1; }
        return container;
      }
      if (container.kind === 'run') {
        const flat = toArray(container);
        if (flat.indexOf(offset) === -1) flat.push(offset);
        flat.sort(function (a, b) { return a - b; });
        return runOptimiseContainer(arrayContainer(flat));
      }
      const values = container.values;
      let low = 0;
      let high = values.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (values[mid] < offset) low = mid + 1;
        else high = mid;
      }
      if (values[low] === offset) return container;
      values.splice(low, 0, offset);
      return promote(container);
    }

    /* ------------------------------------------------------------- bitmap */

    function empty() {
      return { chunks: new Map() };
    }

    function add(bitmap, value) {
      const key = Math.floor(value / CHUNK);
      const offset = value % CHUNK;
      const container = bitmap.chunks.get(key) || arrayContainer();
      bitmap.chunks.set(key, addTo(container, offset));
      return bitmap;
    }

    function fromArray(values) {
      const bitmap = empty();
      values.forEach(function (value) { add(bitmap, value); });
      return bitmap;
    }

    function contains(bitmap, value) {
      const container = bitmap.chunks.get(Math.floor(value / CHUNK));
      return container ? has(container, value % CHUNK) : false;
    }

    function size(bitmap) {
      let total = 0;
      bitmap.chunks.forEach(function (container) { total += cardinality(container); });
      return total;
    }

    function values(bitmap) {
      const keys = Array.from(bitmap.chunks.keys()).sort(function (a, b) { return a - b; });
      const out = [];
      keys.forEach(function (key) {
        toArray(bitmap.chunks.get(key)).sort(function (a, b) { return a - b; })
          .forEach(function (offset) { out.push(key * CHUNK + offset); });
      });
      return out;
    }

    /* --------------------------------------------------------- operations */

    function intersectContainers(left, right) {
      /**
       * Intersection, dispatched on the pair of container types. The array x
       * bitmap path is the one worth reading: it probes the bitmap once per
       * array element and never materialises either side.
       */
      stats.operations += 1;
      if (left.kind === 'bitmap' && right.kind === 'bitmap') {
        const words = new Uint32Array(left.words.length);
        let count = 0;
        for (let i = 0; i < words.length; i += 1) {
          stats.wordsTouched += 1;
          words[i] = (left.words[i] & right.words[i]) >>> 0;
          count += popcount(words[i]);
        }
        const result = bitmapContainer(words);
        result.count = count;
        return result;
      }

      const probe = left.kind === 'bitmap' ? left : right;
      const scan = left.kind === 'bitmap' ? right : left;
      if (probe.kind === 'bitmap') {
        const kept = [];
        toArray(scan).forEach(function (offset) {
          stats.elementsTouched += 1;
          if (has(probe, offset)) kept.push(offset);
        });
        return arrayContainer(kept.sort(function (a, b) { return a - b; }));
      }

      const a = toArray(left).sort(function (x, y) { return x - y; });
      const b = new Set(toArray(right));
      const kept = [];
      a.forEach(function (offset) {
        stats.elementsTouched += 1;
        if (b.has(offset)) kept.push(offset);
      });
      return arrayContainer(kept);
    }

    function unionContainers(left, right) {
      stats.operations += 1;
      if (left.kind === 'bitmap' && right.kind === 'bitmap') {
        const words = new Uint32Array(left.words.length);
        let count = 0;
        for (let i = 0; i < words.length; i += 1) {
          stats.wordsTouched += 1;
          words[i] = (left.words[i] | right.words[i]) >>> 0;
          count += popcount(words[i]);
        }
        const result = bitmapContainer(words);
        result.count = count;
        return result;
      }
      const merged = new Set(toArray(left));
      toArray(right).forEach(function (offset) { stats.elementsTouched += 1; merged.add(offset); });
      return promote(arrayContainer(Array.from(merged).sort(function (a, b) { return a - b; })));
    }

    function differenceContainers(left, right) {
      stats.operations += 1;
      const remove = new Set(toArray(right));
      const kept = toArray(left).filter(function (offset) {
        stats.elementsTouched += 1;
        return !remove.has(offset);
      });
      return promote(arrayContainer(kept.sort(function (a, b) { return a - b; })));
    }

    function combine(a, b, mode) {
      const out = empty();
      const keys = new Set(Array.from(a.chunks.keys()).concat(Array.from(b.chunks.keys())));
      keys.forEach(function (key) {
        const left = a.chunks.get(key);
        const right = b.chunks.get(key);
        let container = null;
        if (mode === 'intersection') {
          if (!left || !right) return;
          container = intersectContainers(left, right);
        } else if (mode === 'union') {
          container = left && right ? unionContainers(left, right) : (left || right);
        } else {
          if (!left) return;
          container = right ? differenceContainers(left, right) : left;
        }
        if (container && cardinality(container)) out.chunks.set(key, container);
      });
      return out;
    }

    function popcount(value) {
      let bits = value >>> 0;
      bits = bits - ((bits >>> 1) & 0x55555555);
      bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
      bits = (bits + (bits >>> 4)) & 0x0f0f0f0f;
      return (Math.imul(bits, 0x01010101) >>> 24);
    }

    /* ------------------------------------------------------ run optimising */

    function runsOf(sorted) {
      const runs = [];
      sorted.forEach(function (offset) {
        const last = runs[runs.length - 1];
        if (last && offset === last.start + last.length) last.length += 1;
        else runs.push({ start: offset, length: 1 });
      });
      return runs;
    }

    function runOptimiseContainer(container) {
      /** A run container wins when 4 bytes per run beats what the alternative
       *  costs; measuring that per chunk is what `runOptimize` is. */
      const sorted = toArray(container).sort(function (a, b) { return a - b; });
      const runs = runsOf(sorted);
      const runBytes = runs.length * 4;
      const alternative = container.kind === 'bitmap' ? CHUNK / 8 : sorted.length * 2;
      if (runBytes >= alternative) return container;
      stats.conversions += 1;
      return runContainer(runs);
    }

    function runOptimize(bitmap) {
      const out = empty();
      bitmap.chunks.forEach(function (container, key) {
        out.chunks.set(key, runOptimiseContainer(container));
      });
      return out;
    }

    /* -------------------------------------------------------------- shape */

    function bytesOf(container) {
      if (container.kind === 'array') return 8 + container.values.length * 2;
      if (container.kind === 'bitmap') return 8 + CHUNK / 8;
      return 8 + container.runs.length * 4;
    }

    function shape(bitmap) {
      const counts = { array: 0, bitmap: 0, run: 0 };
      let bytes = 0;
      let cardinalityTotal = 0;
      let highest = 0;
      bitmap.chunks.forEach(function (container, key) {
        counts[container.kind] += 1;
        bytes += bytesOf(container) + 8;
        cardinalityTotal += cardinality(container);
        if (key > highest) highest = key;
      });
      const universeBits = (highest + 1) * CHUNK;
      return {
        chunks: bitmap.chunks.size,
        containers: counts,
        cardinality: cardinalityTotal,
        bytes: bytes,
        bitsPerValue: cardinalityTotal ? (bytes * 8) / cardinalityTotal : 0,
        rawBitmapBytes: Math.ceil(universeBits / 8),
        sortedArrayBytes: cardinalityTotal * 4,
        compression: bytes ? Math.ceil(universeBits / 8) / bytes : 1
      };
    }

    return {
      empty: empty, add: add, fromArray: fromArray,
      contains: contains, size: size, values: values,
      union: function (a, b) { return combine(a, b, 'union'); },
      intersection: function (a, b) { return combine(a, b, 'intersection'); },
      difference: function (a, b) { return combine(a, b, 'difference'); },
      runOptimize: runOptimize, shape: shape,
      containerOf: function (bitmap, value) {
        const container = bitmap.chunks.get(Math.floor(value / CHUNK));
        return container ? container.kind : null;
      },
      label: settings.label || 'roaring', ARRAY_MAX: ARRAY_MAX, CHUNK: CHUNK,
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  /**
   * Word-aligned hybrid coding, for the comparison. A literal word carries 31
   * data bits; a fill word carries a run length of identical words. It
   * compresses long uniform stretches beautifully and degrades to worse than
   * an uncompressed bitmap on data that alternates - and, unlike Roaring,
   * every operation has to walk both encodings in step.
   */
  function wah(values, options) {
    const settings = options || {};
    const universe = Math.max(1, settings.universe || (values.length ? values[values.length - 1] + 1 : 1));
    const wordBits = 31;
    const wordCount = Math.ceil(universe / wordBits);
    const raw = new Uint32Array(wordCount);
    values.forEach(function (value) {
      raw[Math.floor(value / wordBits)] |= (1 << (value % wordBits));
    });

    const encoded = [];
    let index = 0;
    while (index < wordCount) {
      const word = raw[index] >>> 0;
      if (word === 0 || word === 0x7fffffff) {
        let run = 1;
        while (index + run < wordCount && raw[index + run] === word) run += 1;
        encoded.push({ fill: word === 0 ? 0 : 1, length: run });
        index += run;
      } else {
        encoded.push({ literal: word });
        index += 1;
      }
    }

    return {
      words: encoded.length,
      literals: encoded.filter(function (w) { return w.literal !== undefined; }).length,
      fills: encoded.filter(function (w) { return w.fill !== undefined; }).length,
      bytes: encoded.length * 4,
      rawBytes: wordCount * 4,
      cardinality: values.length,
      bitsPerValue: values.length ? (encoded.length * 32) / values.length : 0
    };
  }

  return { create: create, wah: wah, CHUNK: CHUNK, ARRAY_MAX: ARRAY_MAX };
}));

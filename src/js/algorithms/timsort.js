/**
 * Timsort: run detection, minrun, the merge-stack invariants, galloping - and
 * the invariant bug that survived years in three standard libraries.
 *
 * The design is one observation taken seriously: real data is not random. It
 * arrives in ascending or descending stretches, and a sort that finds them
 * does O(n) work on input an O(n log n) sort would grind through. Timsort
 * detects those runs, extends short ones to `minrun` with a binary insertion
 * sort, pushes them on a stack, and merges neighbours under two invariants
 * that keep the run lengths balanced:
 *
 *     for the top three runs   X, Y, Z (Z deepest):   Z > Y + X   and   Y > X
 *
 * The invariants are what bound the stack depth, and the 2015 formal
 * verification (de Gouw, Rot, de Boer, Bubel, Hähnle) found that checking
 * only the top three runs is not enough - a violation can survive one level
 * down, the stack grows past its proven bound, and Java's fixed-size stack
 * throws `ArrayIndexOutOfBoundsException` on inputs of a few hundred thousand
 * elements. `buggyCollapse: true` reproduces exactly that check, so the
 * section can show the stack growing rather than describe it.
 *
 * Galloping is the second observation: when one run keeps winning, stop
 * comparing one element at a time and binary-search for how far it keeps
 * winning. On interleaved data it costs a little; on clustered data - the
 * case it exists for - it turns k comparisons into log2(k).
 *
 * `runStack` snapshots after every push are returned, so a test can assert
 * the invariants held at each step rather than only at the end.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Timsort = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MIN_MERGE = 32;
  const MIN_GALLOP = 7;

  /**
   * Timsort's minrun. Below `MIN_MERGE` the whole array is one run and a
   * binary insertion sort finishes it. Above it, take the top 5 bits of n and
   * add 1 if any lower bit was set, which lands in [16, 32].
   *
   * The reason is arithmetic, not taste: it makes n/minrun close to - and
   * strictly below - a power of two, so the merge tree comes out balanced.
   * A round minrun like 32 on n = 2 049 leaves a final run of 1 to be merged
   * against a run of 2 048, and that single unbalanced merge costs more than
   * every balanced one before it.
   */
  function minRunLength(n) {
    let remaining = n;
    let carry = 0;
    while (remaining >= MIN_MERGE) {
      carry |= remaining & 1;
      remaining >>= 1;
    }
    return remaining + carry;
  }

  /** The run at `from`: ascending, or strictly descending and then reversed.
   *  Strictness is what lets the reversal keep the sort stable. */
  function countRun(array, from, to, ops) {
    if (from + 1 >= to) return 1;
    let end = from + 1;

    if (ops.cmp(array[end], array[from]) < 0) {
      while (end < to && ops.cmp(array[end], array[end - 1]) < 0) end += 1;
      let i = from;
      let j = end - 1;
      while (i < j) { ops.swap(array, i, j); i += 1; j -= 1; }
    } else {
      while (end < to && ops.cmp(array[end], array[end - 1]) >= 0) end += 1;
    }
    return end - from;
  }

  /** Binary insertion sort over `[from, to)` where `[from, start)` is already
   *  sorted - the routine that pads a short run up to minrun. */
  function binarySort(array, from, to, start, ops) {
    let begin = start === from ? from + 1 : start;
    for (; begin < to; begin += 1) {
      const pivot = array[begin];
      let low = from;
      let high = begin;
      while (low < high) {
        const mid = low + ((high - low) >>> 1);
        if (ops.cmp(pivot, array[mid]) < 0) high = mid;
        else low = mid + 1;
      }
      for (let k = begin; k > low; k -= 1) ops.write(array, k, array[k - 1]);
      if (low !== begin) ops.write(array, low, pivot);
    }
  }

  /* ------------------------------------------------------------ galloping */

  /** Leftmost position in `[base, base+len)` where `key` could be inserted,
   *  found by doubling out from `hint` and then binary-searching. */
  function gallopLeft(key, array, base, len, hint, ops) {
    let lastOffset = 0;
    let offset = 1;

    if (ops.cmp(key, array[base + hint]) > 0) {
      const max = len - hint;
      while (offset < max && ops.cmp(key, array[base + hint + offset]) > 0) {
        lastOffset = offset;
        offset = (offset << 1) + 1;
      }
      if (offset > max) offset = max;
      lastOffset += hint;
      offset += hint;
    } else {
      const max = hint + 1;
      while (offset < max && ops.cmp(key, array[base + hint - offset]) <= 0) {
        lastOffset = offset;
        offset = (offset << 1) + 1;
      }
      if (offset > max) offset = max;
      const held = lastOffset;
      lastOffset = hint - offset;
      offset = hint - held;
    }

    let low = lastOffset + 1;
    let high = offset;
    while (low < high) {
      const mid = low + ((high - low) >>> 1);
      if (ops.cmp(key, array[base + mid]) > 0) low = mid + 1;
      else high = mid;
    }
    return high;
  }

  /** Rightmost such position - the mirror of `gallopLeft`, and the pair is
   *  what keeps the merge stable in both directions. */
  function gallopRight(key, array, base, len, hint, ops) {
    let lastOffset = 0;
    let offset = 1;

    if (ops.cmp(key, array[base + hint]) < 0) {
      const max = hint + 1;
      while (offset < max && ops.cmp(key, array[base + hint - offset]) < 0) {
        lastOffset = offset;
        offset = (offset << 1) + 1;
      }
      if (offset > max) offset = max;
      const held = lastOffset;
      lastOffset = hint - offset;
      offset = hint - held;
    } else {
      const max = len - hint;
      while (offset < max && ops.cmp(key, array[base + hint + offset]) >= 0) {
        lastOffset = offset;
        offset = (offset << 1) + 1;
      }
      if (offset > max) offset = max;
      lastOffset += hint;
      offset += hint;
    }

    let low = lastOffset + 1;
    let high = offset;
    while (low < high) {
      const mid = low + ((high - low) >>> 1);
      if (ops.cmp(key, array[base + mid]) < 0) high = mid;
      else low = mid + 1;
    }
    return high;
  }

  /* --------------------------------------------------------- the merges */

  function copyForward(source, from, target, to, count, ops) {
    for (let k = 0; k < count; k += 1) ops.write(target, to + k, source[from + k]);
  }

  /** Same as `copyForward` but right-to-left, for the overlapping copies a
   *  high merge makes inside the array it is merging. */
  function copyBackward(source, from, target, to, count, ops) {
    for (let k = count - 1; k >= 0; k -= 1) ops.write(target, to + k, source[from + k]);
  }

  /* Both merges keep their cursors in one object, so the pairwise phase and
     the galloping phase can be separate functions over the same state. */

  function finishLow(array, tmp, cursor, ops) {
    copyForward(array, cursor.j, array, cursor.dest, cursor.n2, ops);
    if (cursor.n1 === 1) ops.write(array, cursor.dest + cursor.n2, tmp[cursor.i]);
    cursor.done = true;
  }

  function takeLeftLow(array, tmp, cursor, ops) {
    ops.write(array, cursor.dest, tmp[cursor.i]);
    cursor.dest += 1; cursor.i += 1; cursor.n1 -= 1;
    if (cursor.n1 === 1) finishLow(array, tmp, cursor, ops);
  }

  function takeRightLow(array, tmp, cursor, ops) {
    ops.write(array, cursor.dest, array[cursor.j]);
    cursor.dest += 1; cursor.j += 1; cursor.n2 -= 1;
    if (cursor.n2 === 0) {
      copyForward(tmp, cursor.i, array, cursor.dest, cursor.n1, ops);
      cursor.done = true;
    }
  }

  /** One element at a time, until one run has won `minGallop` times running. */
  function pairwiseLow(array, tmp, cursor, ops, minGallop) {
    let count1 = 0;
    let count2 = 0;
    do {
      if (ops.cmp(array[cursor.j], tmp[cursor.i]) < 0) {
        takeRightLow(array, tmp, cursor, ops); count2 += 1; count1 = 0;
      } else {
        takeLeftLow(array, tmp, cursor, ops); count1 += 1; count2 = 0;
      }
      if (cursor.done) return;
    } while ((count1 | count2) < minGallop);
  }

  /** Binary-search for how far the winning run keeps winning, and move that
   *  whole block at once. This is the half of Timsort that clustered data
   *  pays for and interleaved data does not. */
  function gallopingLow(array, tmp, cursor, ops, state) {
    let count1 = 0;
    let count2 = 0;
    do {
      count1 = gallopRight(array[cursor.j], tmp, cursor.i, cursor.n1, 0, ops);
      state.gallops += 1;
      if (count1 !== 0) {
        copyForward(tmp, cursor.i, array, cursor.dest, count1, ops);
        cursor.dest += count1; cursor.i += count1; cursor.n1 -= count1;
        if (cursor.n1 <= 1) { finishLow(array, tmp, cursor, ops); return; }
      }
      takeRightLow(array, tmp, cursor, ops);
      if (cursor.done) return;

      count2 = gallopLeft(tmp[cursor.i], array, cursor.j, cursor.n2, 0, ops);
      state.gallops += 1;
      if (count2 !== 0) {
        copyForward(array, cursor.j, array, cursor.dest, count2, ops);
        cursor.dest += count2; cursor.j += count2; cursor.n2 -= count2;
        if (cursor.n2 === 0) {
          copyForward(tmp, cursor.i, array, cursor.dest, cursor.n1, ops);
          cursor.done = true;
          return;
        }
      }
      takeLeftLow(array, tmp, cursor, ops);
      if (cursor.done) return;
      state.minGallop -= 1;
    } while (count1 >= MIN_GALLOP || count2 >= MIN_GALLOP);
  }

  /** Merge two adjacent runs, copying the *left* one to scratch. Chosen when
   *  the left run is the shorter, so the scratch is min(len1, len2). */
  function mergeLow(array, base1, len1, base2, len2, ops, state) {
    ops.alloc(len1);
    const tmp = array.slice(base1, base1 + len1);
    const cursor = { i: 0, n1: len1, j: base2, n2: len2, dest: base1, done: false };

    takeRightLow(array, tmp, cursor, ops);
    if (cursor.done) return;
    if (cursor.n1 === 1) { finishLow(array, tmp, cursor, ops); return; }

    while (!cursor.done) {
      pairwiseLow(array, tmp, cursor, ops, Math.max(1, state.minGallop));
      if (cursor.done) return;
      gallopingLow(array, tmp, cursor, ops, state);
      if (cursor.done) return;
      if (state.minGallop < 0) state.minGallop = 0;
      state.minGallop += 2;
    }
  }

  function finishHigh(array, tmp, cursor, ops) {
    cursor.dest -= cursor.n1;
    cursor.i -= cursor.n1;
    copyBackward(array, cursor.i + 1, array, cursor.dest + 1, cursor.n1, ops);
    ops.write(array, cursor.dest, tmp[cursor.j]);
    cursor.done = true;
  }

  function takeLeftHigh(array, tmp, cursor, ops) {
    ops.write(array, cursor.dest, array[cursor.i]);
    cursor.dest -= 1; cursor.i -= 1; cursor.n1 -= 1;
    if (cursor.n1 === 0) {
      copyForward(tmp, 0, array, cursor.dest - cursor.n2 + 1, cursor.n2, ops);
      cursor.done = true;
    }
  }

  function takeRightHigh(array, tmp, cursor, ops) {
    ops.write(array, cursor.dest, tmp[cursor.j]);
    cursor.dest -= 1; cursor.j -= 1; cursor.n2 -= 1;
    if (cursor.n2 === 1) finishHigh(array, tmp, cursor, ops);
  }

  function pairwiseHigh(array, tmp, cursor, ops, minGallop) {
    let count1 = 0;
    let count2 = 0;
    do {
      if (ops.cmp(tmp[cursor.j], array[cursor.i]) < 0) {
        takeLeftHigh(array, tmp, cursor, ops); count1 += 1; count2 = 0;
      } else {
        takeRightHigh(array, tmp, cursor, ops); count2 += 1; count1 = 0;
      }
      if (cursor.done) return;
    } while ((count1 | count2) < minGallop);
  }

  function gallopingHigh(array, tmp, cursor, ops, state, base1) {
    let count1 = 0;
    let count2 = 0;
    do {
      count1 = cursor.n1 - gallopRight(tmp[cursor.j], array, base1, cursor.n1, cursor.n1 - 1, ops);
      state.gallops += 1;
      if (count1 !== 0) {
        cursor.dest -= count1; cursor.i -= count1; cursor.n1 -= count1;
        copyBackward(array, cursor.i + 1, array, cursor.dest + 1, count1, ops);
        if (cursor.n1 === 0) {
          copyForward(tmp, 0, array, cursor.dest - cursor.n2 + 1, cursor.n2, ops);
          cursor.done = true;
          return;
        }
      }
      takeRightHigh(array, tmp, cursor, ops);
      if (cursor.done) return;

      count2 = cursor.n2 - gallopLeft(array[cursor.i], tmp, 0, cursor.n2, cursor.n2 - 1, ops);
      state.gallops += 1;
      if (count2 !== 0) {
        cursor.dest -= count2; cursor.j -= count2; cursor.n2 -= count2;
        copyForward(tmp, cursor.j + 1, array, cursor.dest + 1, count2, ops);
        if (cursor.n2 <= 1) { finishHigh(array, tmp, cursor, ops); return; }
      }
      takeLeftHigh(array, tmp, cursor, ops);
      if (cursor.done) return;
      state.minGallop -= 1;
    } while (count1 >= MIN_GALLOP || count2 >= MIN_GALLOP);
  }

  /** The mirror image: copies the *right* run to scratch and fills from the
   *  high end downwards. Chosen when the right run is the shorter. */
  function mergeHigh(array, base1, len1, base2, len2, ops, state) {
    ops.alloc(len2);
    const tmp = array.slice(base2, base2 + len2);
    const cursor = {
      i: base1 + len1 - 1, n1: len1, j: len2 - 1, n2: len2,
      dest: base2 + len2 - 1, done: false
    };

    takeLeftHigh(array, tmp, cursor, ops);
    if (cursor.done) return;
    if (cursor.n2 === 1) { finishHigh(array, tmp, cursor, ops); return; }

    while (!cursor.done) {
      pairwiseHigh(array, tmp, cursor, ops, Math.max(1, state.minGallop));
      if (cursor.done) return;
      gallopingHigh(array, tmp, cursor, ops, state, base1);
      if (cursor.done) return;
      if (state.minGallop < 0) state.minGallop = 0;
      state.minGallop += 2;
    }
  }

  /**
   * Merge the runs at stack positions `at` and `at + 1`.
   *
   * The two gallop calls before the merge are not a micro-optimisation: they
   * trim the elements of run1 already below everything in run2, and the
   * elements of run2 already above everything in run1. After that trim the
   * *last* element of run1 is the largest of the pair, which is the fact
   * `mergeLow` relies on to know its left run cannot run out first.
   */
  function mergeAt(array, stack, at, ops, state) {
    const left = stack[at];
    const right = stack[at + 1];
    let base1 = left.from;
    let len1 = left.length;
    const base2 = right.from;
    let len2 = right.length;

    stack[at] = { from: left.from, length: len1 + len2 };
    stack.splice(at + 1, 1);
    state.merges += 1;

    const skip = gallopRight(array[base2], array, base1, len1, 0, ops);
    base1 += skip;
    len1 -= skip;
    if (len1 === 0) return;

    len2 = gallopLeft(array[base1 + len1 - 1], array, base2, len2, len2 - 1, ops);
    if (len2 === 0) return;

    if (len1 <= len2) mergeLow(array, base1, len1, base2, len2, ops, state);
    else mergeHigh(array, base1, len1, base2, len2, ops, state);
  }

  /* ---------------------------------------------------- the merge stack */

  /**
   * The two invariants, checked over the whole stack rather than its top.
   *
   * A run stack that satisfies them has depth O(log n), which is the bound
   * Java's fixed-size array was sized from. The result is a list rather than
   * a throw, because the section's whole point is that the buggy version does
   * not fail loudly - it just grows.
   */
  function checkInvariants(stack) {
    const violations = [];
    for (let i = 0; i + 2 < stack.length; i += 1) {
      if (stack[i].length <= stack[i + 1].length + stack[i + 2].length) {
        violations.push({
          at: i, rule: 'Z > Y + X',
          lengths: [stack[i].length, stack[i + 1].length, stack[i + 2].length]
        });
      }
    }
    for (let i = 0; i + 1 < stack.length; i += 1) {
      if (stack[i].length <= stack[i + 1].length) {
        violations.push({ at: i, rule: 'Y > X', lengths: [stack[i].length, stack[i + 1].length] });
      }
    }
    return violations;
  }

  /**
   * The fixed collapse rule. It looks one run deeper than the original did:
   * the `deep` clause is the line the 2015 paper added, and deleting it is
   * exactly `buggyCollapse`.
   */
  function collapse(array, stack, ops, state) {
    while (stack.length > 1) {
      let n = stack.length - 2;
      const shallow = n >= 1 && stack[n - 1].length <= stack[n].length + stack[n + 1].length;
      const deep = n >= 2 && stack[n - 2].length <= stack[n].length + stack[n - 1].length;
      if (shallow || deep) {
        if (stack[n - 1].length < stack[n + 1].length) n -= 1;
      } else if (stack[n].length > stack[n + 1].length) {
        return;
      }
      mergeAt(array, stack, n, ops, state);
    }
  }

  /** The pre-2015 rule, kept so the failure can be shown rather than told. It
   *  only ever looks at the top three runs, so a violation one level down
   *  survives and the stack outgrows the bound its size was proved from. */
  function buggyCollapse(array, stack, ops, state) {
    while (stack.length > 1) {
      let n = stack.length - 2;
      if (n > 0 && stack[n - 1].length <= stack[n].length + stack[n + 1].length) {
        if (stack[n - 1].length < stack[n + 1].length) n -= 1;
      } else if (stack[n].length > stack[n + 1].length) {
        return;
      }
      mergeAt(array, stack, n, ops, state);
    }
  }

  function forceCollapse(array, stack, ops, state) {
    while (stack.length > 1) {
      let n = stack.length - 2;
      if (n > 0 && stack[n - 1].length < stack[n + 1].length) n -= 1;
      mergeAt(array, stack, n, ops, state);
    }
  }

  /**
   * A snapshot of the stack, taken twice per run: once as the run is pushed
   * and once after the collapse has run.
   *
   * Only the *settled* snapshot counts against `invariantViolations`. A stack
   * is allowed to violate the invariants the instant a run lands on it - that
   * is precisely what the collapse exists to repair. The claim being tested
   * is that no violation survives the collapse, and that is the claim the
   * buggy rule fails.
   */
  function recordStack(stack, report, settled) {
    if (stack.length > report.maxStackDepth) report.maxStackDepth = stack.length;
    const violations = checkInvariants(stack);
    if (settled) report.invariantViolations += violations.length;
    if (report.stackHistory.length < 400) {
      report.stackHistory.push({
        lengths: stack.map(function (run) { return run.length; }),
        violations: violations.length,
        settled: !!settled
      });
    }
  }

  function emptyReport() {
    return {
      runs: 0, naturalRuns: 0, merges: 0, gallops: 0, minRun: 0,
      maxStackDepth: 0, invariantViolations: 0, stackHistory: []
    };
  }

  /**
   * The sort. It returns the run stack's whole history rather than only the
   * answer, because the section is about the stack: a test that can see only
   * the sorted array cannot check an invariant.
   */
  function sort(array, ops, options) {
    const settings = options || {};
    const n = array.length;
    const state = { minGallop: settings.minGallop || MIN_GALLOP, gallops: 0, merges: 0 };
    const report = emptyReport();

    if (n < 2) return report;
    if (n < MIN_MERGE) {
      report.runs = 1;
      report.naturalRuns = 1;
      report.minRun = n;
      binarySort(array, 0, n, countRun(array, 0, n, ops), ops);
      return report;
    }

    const minRun = settings.minRun || minRunLength(n);
    const collapseWith = settings.buggyCollapse ? buggyCollapse : collapse;
    const stack = [];
    report.minRun = minRun;

    let from = 0;
    while (from < n) {
      let runLength = countRun(array, from, n, ops);
      report.naturalRuns += 1;
      if (runLength < minRun) {
        const forced = Math.min(minRun, n - from);
        binarySort(array, from, from + forced, from + runLength, ops);
        runLength = forced;
      }
      stack.push({ from: from, length: runLength });
      report.runs += 1;
      recordStack(stack, report, false);
      collapseWith(array, stack, ops, state);
      recordStack(stack, report, true);
      from += runLength;
    }

    forceCollapse(array, stack, ops, state);
    report.merges = state.merges;
    report.gallops = state.gallops;
    return report;
  }

  return {
    MIN_MERGE: MIN_MERGE,
    MIN_GALLOP: MIN_GALLOP,
    minRunLength: minRunLength,
    countRun: countRun,
    binarySort: binarySort,
    gallopLeft: gallopLeft,
    gallopRight: gallopRight,
    checkInvariants: checkInvariants,
    mergeAt: mergeAt,
    sort: sort
  };
}));

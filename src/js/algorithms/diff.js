/**
 * Diff: Myers's edit graph, and the reason the minimal answer is often the
 * least readable one.
 *
 * Myers walks the edit graph diagonal by diagonal, keeping for each diagonal
 * the furthest-reaching point at the current edit distance D. Because a
 * greedy "slide down the diagonal as far as the lines match" step is free, the
 * whole search costs O((N+M)·D) - proportional to the SIZE OF THE ANSWER
 * rather than to the size of the input, which is why diffing two nearly
 * identical files is instant however large they are.
 *
 * The second half is the uncomfortable one: minimal and legible are different
 * objectives. On a file with many repeated lines - a closing brace, a blank
 * line, a `}` - the shortest edit script interleaves hunks in a way no human
 * reads as the change that was made. Patience diff throws away optimality and
 * anchors on lines that are unique in both files, and the panel measures the
 * difference in hunk count rather than describing it.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Diff = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { diagonals: 0, snakes: 0, distance: 0, comparisons: 0,
      hunks: 0, anchors: 0, conflicts: 0 };
  }

  /**
   * Myers's greedy algorithm with the whole V-array kept per D, so the path
   * can be reconstructed backwards. That is the O(ND) space version; the
   * linear-space refinement divides and conquers on the middle snake instead
   * and is what a real implementation ships.
   */
  function myers(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const n = a.length;
    const m = b.length;
    const max = n + m;
    const v = new Map([[1, 0]]);
    const trace = [];

    for (let d = 0; d <= max; d += 1) {
      trace.push(new Map(v));

      for (let k = -d; k <= d; k += 2) {
        report.diagonals += 1;
        let x = pickStart(v, k, d);
        let y = x - k;

        while (x < n && y < m && a[x] === b[y]) {
          report.comparisons += 1;
          report.snakes += 1;
          x += 1;
          y += 1;
        }

        if (x < n && y < m) report.comparisons += 1;
        v.set(k, x);

        if (x < n || y < m) continue;
        report.distance = d;
        return { distance: d, script: backtrack(a, b, trace, d, k), report: report,
          trace: trace };
      }
    }
    return { distance: max, script: [], report: report, trace: trace };
  }

  /** Move down from k+1 or right from k−1, whichever reaches further. */
  function pickStart(v, k, d) {
    const down = v.get(k + 1);
    const right = v.get(k - 1);

    if (k === -d) return down === undefined ? 0 : down;

    if (k !== d && (right === undefined || (down !== undefined && right < down))) {
      return down === undefined ? 0 : down;
    }
    return (right === undefined ? 0 : right) + 1;
  }

  /**
   * Walk the recorded V-arrays backwards to recover the script. Each step is
   * one insertion or deletion plus the run of equal lines that preceded it -
   * the "snake" - and reversing at the end puts them in file order.
   */
  function backtrack(a, b, trace, d, endK) {
    const script = [];
    let k = endK;
    let x = trace[d].get(k) === undefined ? a.length : a.length;
    let y = x - k;

    x = a.length;
    y = b.length;

    for (let step = d; step > 0; step -= 1) {
      const v = trace[step];
      const k2 = x - y;
      const down = v.get(k2 + 1);
      const right = v.get(k2 - 1);
      const goDown = k2 === -step ||
        (k2 !== step && (right === undefined || (down !== undefined && right < down)));
      const previousK = goDown ? k2 + 1 : k2 - 1;
      const previousX = v.get(previousK) === undefined ? 0 : v.get(previousK);
      const previousY = previousX - previousK;

      while (x > previousX && y > previousY) {
        script.push({ kind: 'equal', a: x - 1, b: y - 1, line: a[x - 1] });
        x -= 1;
        y -= 1;
      }

      if (goDown) script.push({ kind: 'insert', a: x, b: y - 1, line: b[y - 1] });
      else script.push({ kind: 'delete', a: x - 1, b: y, line: a[x - 1] });
      x = previousX;
      y = previousY;
    }

    while (x > 0 && y > 0) {
      script.push({ kind: 'equal', a: x - 1, b: y - 1, line: a[x - 1] });
      x -= 1;
      y -= 1;
    }
    return script.reverse();
  }

  /**
   * Apply the script to A and check it produces B exactly. A diff that does
   * not round-trip is the only kind worth asserting about, because an edit
   * script is otherwise just a plausible list of line numbers.
   */
  function apply(a, script) {
    const out = [];

    script.forEach(function (step) {
      if (step.kind === 'delete') return;
      out.push(step.line);
    });
    return out;
  }

  function roundTrips(a, b, script) {
    const built = apply(a, script);

    return { built: built, ok: built.length === b.length &&
      built.every(function (line, i) { return line === b[i]; }) };
  }

  /** Consecutive non-equal steps, grouped: what a reader counts as "changes". */
  function hunks(script) {
    const out = [];
    let current = null;

    script.forEach(function (step, i) {
      if (step.kind === 'equal') { current = null; return; }

      if (current === null) {
        current = { from: i, deletes: 0, inserts: 0 };
        out.push(current);
      }

      if (step.kind === 'delete') current.deletes += 1;
      else current.inserts += 1;
    });
    return out;
  }

  /* ---------------------------------------------------------- patience */

  /**
   * Patience diff: anchor on lines that appear EXACTLY ONCE in each file, take
   * the longest increasing subsequence of those anchors, and recurse between
   * them. It gives up minimality and buys hunks that correspond to the change
   * somebody actually made.
   */
  function patience(a, b, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const script = patienceRange(a, b, 0, a.length, 0, b.length, report);

    report.hunks = hunks(script).length;
    report.distance = script.filter(function (step) { return step.kind !== 'equal'; }).length;
    return { script: script, report: report, distance: report.distance };
  }

  function patienceRange(a, b, aFrom, aTo, bFrom, bTo, report) {
    const anchors = uniqueCommon(a, b, aFrom, aTo, bFrom, bTo);
    const chain = longestIncreasing(anchors);

    report.anchors += chain.length;

    if (chain.length === 0) return fallback(a, b, aFrom, aTo, bFrom, bTo, report);
    const out = [];
    let x = aFrom;
    let y = bFrom;

    chain.forEach(function (anchor) {
      pushAll(out, patienceRange(a, b, x, anchor.a, y, anchor.b, report));
      out.push({ kind: 'equal', a: anchor.a, b: anchor.b, line: a[anchor.a] });
      x = anchor.a + 1;
      y = anchor.b + 1;
    });
    pushAll(out, patienceRange(a, b, x, aTo, y, bTo, report));
    return out;
  }

  function pushAll(out, more) {
    more.forEach(function (step) { out.push(step); });
  }

  /** A plain Myers run on the remaining range, offset back into file
   *  coordinates - patience is an anchoring strategy, not a whole algorithm. */
  function fallback(a, b, aFrom, aTo, bFrom, bTo, report) {
    const left = a.slice(aFrom, aTo);
    const right = b.slice(bFrom, bTo);

    if (left.length === 0 && right.length === 0) return [];
    const run = myers(left, right, { report: report });

    return run.script.map(function (step) {
      return { kind: step.kind, a: step.a + aFrom, b: step.b + bFrom, line: step.line };
    });
  }

  /** Lines occurring exactly once in each side of the range. */
  function uniqueCommon(a, b, aFrom, aTo, bFrom, bTo) {
    const left = countLines(a, aFrom, aTo);
    const right = countLines(b, bFrom, bTo);
    const out = [];

    left.forEach(function (entry, line) {
      if (entry.count !== 1) return;
      const other = right.get(line);

      if (!other || other.count !== 1) return;
      out.push({ a: entry.at, b: other.at });
    });
    return out.sort(function (x, y) { return x.a - y.a; });
  }

  function countLines(lines, from, to) {
    const counts = new Map();

    for (let i = from; i < to; i += 1) {
      const entry = counts.get(lines[i]);

      if (entry) entry.count += 1;
      else counts.set(lines[i], { count: 1, at: i });
    }
    return counts;
  }

  /** Longest increasing subsequence by b, patience-sorted - the algorithm the
   *  diff is named after. */
  function longestIncreasing(anchors) {
    const piles = [];
    const back = [];

    anchors.forEach(function (anchor, index) {
      let low = 0;
      let high = piles.length;

      while (low < high) {
        const mid = (low + high) >> 1;

        if (anchors[piles[mid]].b < anchor.b) low = mid + 1;
        else high = mid;
      }
      back[index] = low > 0 ? piles[low - 1] : -1;
      piles[low] = index;
    });

    if (piles.length === 0) return [];
    const out = [];
    let at = piles[piles.length - 1];

    while (at !== -1 && at !== undefined) {
      out.push(anchors[at]);
      at = back[at];
    }
    return out.reverse();
  }

  /* -------------------------------------------------------- three-way */

  /**
   * What each base line became on one side: `replacement[i]` is the lines that
   * stand where base line i stood (empty if it was deleted), and `prefix[i]`
   * is the lines inserted immediately before it. Splitting the two is what
   * lets an insertion on one side and a modification on the other coexist
   * without being called a conflict.
   */
  function sideOf(base, other) {
    const script = myers(base, other, {}).script;
    const replacement = [];
    const prefix = [];

    for (let i = 0; i <= base.length; i += 1) { replacement.push(null); prefix.push([]); }
    let at = 0;
    let pending = [];

    script.forEach(function (step) {
      if (step.kind === 'insert') { pending.push(step.line); return; }
      prefix[at] = prefix[at].concat(pending);
      pending = [];
      replacement[at] = step.kind === 'equal' ? [step.line] : [];
      at += 1;
    });
    prefix[base.length] = prefix[base.length].concat(pending);
    return { replacement: replacement, prefix: prefix };
  }

  /**
   * Three-way merge against a base. A position changed on one side only takes
   * that side; changed identically on both takes it once; changed differently
   * on both is a CONFLICT, reported rather than resolved. A merge tool that
   * silently picks a side is a merge tool nobody can trust, so the conflict
   * count is the output that matters.
   */
  function merge(base, left, right) {
    const report = emptyReport();
    const a = sideOf(base, left);
    const b = sideOf(base, right);
    const out = [];
    const conflicts = [];

    for (let i = 0; i <= base.length; i += 1) {
      mergeAt({ base: base, i: i, a: a, b: b, out: out, conflicts: conflicts });
    }
    report.conflicts = conflicts.length;
    return { lines: out, conflicts: conflicts, report: report };
  }

  function mergeAt(context) {
    const i = context.i;

    emit(context, context.a.prefix[i], context.b.prefix[i], null, 'insertion');

    if (i >= context.base.length) return;
    const original = [context.base[i]];

    emit(context, context.a.replacement[i] || original, context.b.replacement[i] || original,
      original, 'change');
  }

  /** One position, both sides, and the base if there is one. */
  function emit(context, left, right, original, kind) {
    const leftChanged = original === null ? left.length > 0 : !sameLines(left, original);
    const rightChanged = original === null ? right.length > 0 : !sameLines(right, original);

    if (sameLines(left, right)) { pushAll(context.out, left); return; }

    if (leftChanged && !rightChanged) { pushAll(context.out, left); return; }

    if (rightChanged && !leftChanged) { pushAll(context.out, right); return; }
    context.conflicts.push({ at: context.i, kind: kind, left: left, right: right });
    context.out.push('<<<<<<<');
    pushAll(context.out, left);
    context.out.push('=======');
    pushAll(context.out, right);
    context.out.push('>>>>>>>');
  }

  function sameLines(a, b) {
    return a.length === b.length && a.every(function (line, i) { return line === b[i]; });
  }

  return {
    emptyReport: emptyReport, myers: myers, apply: apply, roundTrips: roundTrips,
    hunks: hunks, patience: patience, longestIncreasing: longestIncreasing,
    uniqueCommon: uniqueCommon, merge: merge, sideOf: sideOf
  };
}));

/**
 * One generator set, one counter set, one oracle - so every sort in M10 is
 * measured the same way and every answer is checked.
 *
 * The rule this harness exists to enforce: a sort is never reported on one
 * input. Seven generators run against every implementation, because the whole
 * subject is that the ranking changes with the shape of the data. Insertion
 * sort is last on random input and first on nearly-sorted; quicksort with a
 * median-of-three pivot is excellent everywhere except on the one arrangement
 * built to defeat it. A benchmark on uniform random data measures one column
 * of a table and reports it as the table.
 *
 * Every run also carries a verdict from a reference sort, and a stability
 * check for the algorithms that claim it - `wrong` and `unstable` are fields
 * in the result rather than exceptions, because a sort that is subtly wrong
 * is the case worth *displaying*.
 *
 * Stability is checked the only way it can be: every element is tagged with
 * its original index before the sort, so equal keys carry the evidence of
 * where they started. Without the tag, "did equal elements keep their order"
 * is not a question the output can answer.
 *
 * Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SortLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function load(name, global) {
    if (scope && scope[global]) return scope[global];
    return requireFn ? requireFn(name) : null;
  }

  function Random() { return load('../utils/random.js', 'Random'); }
  function SortOps() { return load('../algorithms/sort-ops.js', 'SortOps'); }
  function Elementary() { return load('../algorithms/sorts-elementary.js', 'SortsElementary'); }
  function MergeSort() { return load('../algorithms/merge-sort.js', 'MergeSort'); }
  function QuickSort() { return load('../algorithms/quick-sort.js', 'QuickSort'); }
  function Timsort() { return load('../algorithms/timsort.js', 'Timsort'); }
  function Pdqsort() { return load('../algorithms/pdqsort.js', 'Pdqsort'); }
  function RadixSort() { return load('../algorithms/radix-sort.js', 'RadixSort'); }

  /* ------------------------------------------------------- generators */

  /**
   * The seven shapes. Six of them are shapes real data actually has; the
   * seventh is built by an adversary and is the only one that is not.
   */
  const GENERATORS = {
    random: {
      label: 'random',
      note: 'the only shape most benchmarks measure',
      build: function (n, random) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = random.int(1000000);
        return out;
      }
    },
    sorted: {
      label: 'already sorted',
      note: 'the shape a re-sorted list arrives in',
      build: function (n) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = i;
        return out;
      }
    },
    reversed: {
      label: 'reversed',
      note: 'the shape a descending re-sort arrives in',
      build: function (n) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = n - i;
        return out;
      }
    },
    'nearly-sorted': {
      label: 'nearly sorted',
      note: 'a sorted list with 1 in 64 elements disturbed - the common case',
      build: function (n, random) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = i % 64 === 0 ? random.int(n) : i;
        return out;
      }
    },
    'few-unique': {
      label: 'few unique',
      note: 'a status column: three distinct values over the whole array',
      build: function (n, random) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = random.int(3);
        return out;
      }
    },
    'organ-pipe': {
      label: 'organ pipe',
      note: 'up then down - defeats a median-of-three pivot without being adversarial',
      build: function (n) {
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = i < n / 2 ? i : n - i;
        return out;
      }
    },
    adversarial: {
      label: 'adversarial',
      note: 'built against median-of-three by McIlroy\'s anti-quicksort',
      build: function (n) {
        return QuickSort().adversarialInput(n, { partition: 'lomuto', pivot: 'median-of-three' });
      }
    }
  };

  /** Tag every value with the position it started in, so stability is a
   *  question the output can answer. */
  function tag(values) {
    return values.map(function (value, index) { return { key: value, at: index }; });
  }

  function input(kind, n, seed) {
    const generator = GENERATORS[kind] || GENERATORS.random;
    return generator.build(Math.max(0, Math.floor(n)), Random().seeded(seed || 1));
  }

  /* -------------------------------------------------- the implementations */

  function opsFor() {
    return SortOps().create({ key: function (item) { return item.key; } });
  }

  const ALGORITHMS = {
    insertion: {
      label: 'insertion', family: 'elementary', stable: true,
      run: function (items, ops) { Elementary().insertionSort(items, ops, {}); }
    },
    selection: {
      label: 'selection', family: 'elementary', stable: false,
      run: function (items, ops) { Elementary().selectionSort(items, ops); }
    },
    bubble: {
      label: 'bubble', family: 'elementary', stable: true,
      run: function (items, ops) { Elementary().bubbleSort(items, ops); }
    },
    shell: {
      label: 'shell', family: 'elementary', stable: false,
      run: function (items, ops) { Elementary().shellSort(items, ops); }
    },
    'merge-top-down': {
      label: 'merge (top-down)', family: 'merge', stable: true,
      run: function (items, ops) { MergeSort().topDownSort(items, ops, {}); }
    },
    'merge-bottom-up': {
      label: 'merge (bottom-up)', family: 'merge', stable: true,
      run: function (items, ops) { MergeSort().bottomUpSort(items, ops, {}); }
    },
    'merge-natural': {
      label: 'merge (natural)', family: 'merge', stable: true,
      run: function (items, ops) { MergeSort().naturalSort(items, ops, {}); }
    },
    'merge-in-place': {
      label: 'merge (in place)', family: 'merge', stable: true,
      run: function (items, ops) { MergeSort().inPlaceSort(items, ops); }
    },
    'quick-lomuto': {
      label: 'quicksort (Lomuto, median-of-three)', family: 'quick', stable: false,
      run: function (items, ops) {
        QuickSort().sort(items, ops, { partition: 'lomuto', pivot: 'median-of-three' });
      }
    },
    'quick-hoare': {
      label: 'quicksort (Hoare, median-of-three)', family: 'quick', stable: false,
      run: function (items, ops) {
        QuickSort().sort(items, ops, { partition: 'hoare', pivot: 'median-of-three' });
      }
    },
    'quick-three-way': {
      label: 'quicksort (three-way, ninther)', family: 'quick', stable: false,
      run: function (items, ops) {
        QuickSort().sort(items, ops, { partition: 'three-way', pivot: 'ninther' });
      }
    },
    introsort: {
      label: 'introsort', family: 'quick', stable: false,
      run: function (items, ops) {
        QuickSort().introSort(items, ops, { insertionSort: Elementary().insertionSort });
      }
    },
    timsort: {
      label: 'Timsort', family: 'library', stable: true,
      run: function (items, ops) { Timsort().sort(items, ops, {}); }
    },
    pdqsort: {
      label: 'pdqsort', family: 'library', stable: false,
      run: function (items, ops) { Pdqsort().sort(items, ops, {}); }
    },
    'radix-lsd': {
      label: 'LSD radix (8 bits)', family: 'non-comparison', stable: true,
      run: function (items, ops) {
        RadixSort().lsdRadixSort(items, ops, { bits: 8, key: function (item) { return item.key; } });
      }
    }
  };

  /* ------------------------------------------------------------ running */

  /** The oracle. A separate sort, over a copy, used only to decide whether
   *  an implementation's answer is right. */
  function reference(items) {
    return items.slice().sort(function (a, b) {
      return a.key === b.key ? a.at - b.at : (a.key < b.key ? -1 : 1);
    });
  }

  function verdict(sorted, expected) {
    let wrong = 0;
    let unstable = 0;

    for (let i = 0; i < expected.length; i += 1) {
      if (!sorted[i] || sorted[i].key !== expected[i].key) wrong += 1;
    }
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i - 1] && sorted[i] && sorted[i - 1].key === sorted[i].key
        && sorted[i - 1].at > sorted[i].at) unstable += 1;
    }
    return { wrong: wrong, unstable: unstable };
  }

  /**
   * Run one algorithm on one input. `elapsedMs` is a median over repeats and
   * always travels with its run count - a single timing of a sort is a
   * measurement of the JIT's mood.
   */
  function run(options) {
    const settings = options || {};
    const algorithm = ALGORITHMS[settings.algorithm];
    if (!algorithm) return null;

    const values = settings.values || input(settings.kind, settings.size, settings.seed);
    const repeats = Math.max(1, Math.floor(settings.repeats || 1));
    const expected = reference(tag(values));
    const timings = [];
    let ops = null;
    let sorted = null;

    for (let attempt = 0; attempt < repeats; attempt += 1) {
      const items = tag(values);
      ops = opsFor();
      const started = now();
      algorithm.run(items, ops);
      timings.push(now() - started);
      sorted = items;
    }

    const checked = verdict(sorted, expected);
    const stats = ops.stats();
    return {
      algorithm: settings.algorithm, label: algorithm.label, family: algorithm.family,
      kind: settings.kind, size: values.length, runs: repeats,
      comparisons: stats.comparisons, swaps: stats.swaps, moves: stats.moves,
      allocations: stats.allocations, allocatedSlots: stats.allocatedSlots,
      wrong: checked.wrong, unstable: checked.unstable,
      claimsStable: algorithm.stable,
      stabilityHonest: algorithm.stable ? checked.unstable === 0 : true,
      elapsedMs: median(timings),
      comparisonsPerElement: values.length ? stats.comparisons / values.length : 0
    };
  }

  function now() {
    if (scope && scope.performance && scope.performance.now) return scope.performance.now();
    return Date.now();
  }

  function median(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const mid = sorted.length >>> 1;
    if (!sorted.length) return 0;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Every algorithm against one input shape - the row of the table. */
  function compare(options) {
    const settings = options || {};
    const names = settings.algorithms || Object.keys(ALGORITHMS);
    const values = input(settings.kind, settings.size, settings.seed);
    return names.map(function (name) {
      return run({
        algorithm: name, kind: settings.kind, values: values,
        repeats: settings.repeats, size: values.length
      });
    }).filter(Boolean);
  }

  /**
   * One algorithm against every input shape - the column. This is the view
   * the section leads with, because it is the one that shows the ranking
   * changing.
   */
  function acrossShapes(options) {
    const settings = options || {};
    const kinds = settings.kinds || Object.keys(GENERATORS);
    return kinds.map(function (kind) {
      return {
        kind: kind,
        label: GENERATORS[kind].label,
        note: GENERATORS[kind].note,
        rows: compare({
          kind: kind, size: settings.size, seed: settings.seed,
          algorithms: settings.algorithms, repeats: settings.repeats
        })
      };
    });
  }

  /**
   * The comparator-contract demo. A comparator that is not a strict weak
   * ordering does not throw in JavaScript - `Array.prototype.sort` returns
   * *something*, and that something is not sorted. The counts are what the
   * section shows instead of the claim.
   */
  const BROKEN_COMPARATORS = {
    correct: {
      label: 'a - b',
      note: 'the contract, satisfied',
      compare: function (a, b) { return a - b; }
    },
    'boolean-return': {
      label: 'a > b',
      note: 'returns true/false; false becomes 0, so half the pairs claim equality',
      compare: function (a, b) { return a > b; }
    },
    'default-string': {
      label: 'no comparator at all',
      note: 'the default sort compares stringified values: 10 sorts before 2',
      compare: null
    },
    'random-order': {
      label: 'a random verdict per call',
      note: 'not transitive, not antisymmetric, and it never throws',
      compare: function () { return Math.random() < 0.5 ? -1 : 1; }
    },
    'reversed-on-equal': {
      label: 'returns 1 when equal',
      note: 'irreflexivity broken: compare(x, x) is 1',
      compare: function (a, b) { return a < b ? -1 : 1; }
    }
  };

  /**
   * Run each broken comparator through the *platform* sort and report what
   * came back. Nothing here is simulated: this is `Array.prototype.sort` and
   * these are its real answers.
   */
  function comparatorReport(options) {
    const settings = options || {};
    const size = Math.max(2, Math.floor(settings.size || 40));
    const values = input('random', size, settings.seed || 5).map(function (value) {
      return value % 1000;
    });
    const expected = values.slice().sort(function (a, b) { return a - b; });

    return Object.keys(BROKEN_COMPARATORS).map(function (name) {
      const entry = BROKEN_COMPARATORS[name];
      const items = values.slice();
      let threw = null;
      try {
        if (entry.compare) items.sort(entry.compare);
        else items.sort();
      } catch (error) { threw = error.message; }

      let inversions = 0;
      for (let i = 1; i < items.length; i += 1) {
        if (Number(items[i - 1]) > Number(items[i])) inversions += 1;
      }
      const audit = entry.compare
        ? SortOps().auditComparator(entry.compare, values)
        : { violations: 0, pairs: 0, triples: 0 };

      return {
        name: name, label: entry.label, note: entry.note,
        threw: threw, sorted: inversions === 0 && !threw,
        outOfOrderPairs: inversions,
        matchesCorrect: JSON.stringify(items) === JSON.stringify(expected),
        axiomViolations: audit.violations,
        sample: items.slice(0, 12)
      };
    });
  }

  return {
    generators: GENERATORS,
    kinds: Object.keys(GENERATORS),
    algorithms: ALGORITHMS,
    algorithmNames: Object.keys(ALGORITHMS),
    brokenComparators: BROKEN_COMPARATORS,
    input: input,
    tag: tag,
    reference: reference,
    run: run,
    compare: compare,
    acrossShapes: acrossShapes,
    comparatorReport: comparatorReport
  };
}));

/**
 * Graded exercises for the sorting sections (M10.1-M10.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'sorting-contract': [{
      id: 'stable-adaptive-insertion',
      title: 'a sort that is stable and adaptive, and can prove both',
      prompt: 'stableSort(items, compare) must return { sorted, stats }, where stats is ' +
        '{ comparisons, moves }. Two promises are graded, not just the order: the sort must be ' +
        'STABLE (two elements the comparator calls equal come out in their original order) and ' +
        'ADAPTIVE (an already-sorted input of n elements costs at most n - 1 comparisons and zero ' +
        'moves). Count one comparison per call to compare, and one move per element written into ' +
        'the array. The provided starter sorts correctly and keeps neither promise.',
      entry: 'stableSort',
      starter: [
        'function stableSort(items, compare) {',
        '  const a = items.slice();',
        '  let comparisons = 0;',
        '  let moves = 0;',
        '',
        '  // selection sort: correct, minimal moves, and it keeps neither promise',
        '  for (let i = 0; i < a.length; i += 1) {',
        '    let best = i;',
        '    for (let j = i + 1; j < a.length; j += 1) {',
        '      comparisons += 1;',
        '      if (compare(a[j], a[best]) < 0) best = j;',
        '    }',
        '    if (best !== i) {',
        '      const held = a[i];',
        '      a[i] = a[best];',
        '      a[best] = held;',
        '      moves += 2;',
        '    }',
        '  }',
        '',
        '  return { sorted: a, stats: { comparisons: comparisons, moves: moves } };',
        '}'
      ].join('\n'),
      solution: [
        'function stableSort(items, compare) {',
        '  const a = items.slice();',
        '  let comparisons = 0;',
        '  let moves = 0;',
        '',
        '  for (let i = 1; i < a.length; i += 1) {',
        '    const value = a[i];',
        '    let j = i - 1;',
        '    let shifted = false;',
        '',
        '    // <= 0 stops at an equal element, which is exactly what stability is',
        '    while (j >= 0) {',
        '      comparisons += 1;',
        '      if (compare(a[j], value) <= 0) break;',
        '      a[j + 1] = a[j];',
        '      moves += 1;',
        '      shifted = true;',
        '      j -= 1;',
        '    }',
        '',
        '    // an already-placed element is never written back, so sorted input costs 0 moves',
        '    if (shifted) {',
        '      a[j + 1] = value;',
        '      moves += 1;',
        '    }',
        '  }',
        '',
        '  return { sorted: a, stats: { comparisons: comparisons, moves: moves } };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it sorts, by the comparator it was given',
          assert: function (stableSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 400; i += 1) items.push(random.int(1000));

            const byValue = function (a, b) { return a - b; };
            const result = stableSort(items, byValue);
            const expected = items.slice().sort(byValue);
            api.assert.deepEqual(result.sorted, expected, 'ascending');

            const descending = stableSort(items, function (a, b) { return b - a; });
            api.assert.deepEqual(descending.sorted, expected.slice().reverse(), 'descending');
            api.assert.equal(items.length, 400, 'the input must not be mutated');
          }
        },
        {
          name: 'it is stable: equal elements keep their original order',
          assert: function (stableSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 600; i += 1) items.push({ key: random.int(8), tag: i });

            const result = stableSort(items, function (a, b) { return a.key - b.key; });
            api.assert.equal(result.sorted.length, 600, 'element count');

            for (let i = 1; i < result.sorted.length; i += 1) {
              const before = result.sorted[i - 1];
              const here = result.sorted[i];
              api.assert.ok(before.key <= here.key, 'sorted at ' + i);
              if (before.key === here.key) {
                api.assert.ok(before.tag < here.tag,
                  'ties reordered at ' + i + ': tag ' + before.tag + ' came after ' + here.tag);
              }
            }
          }
        },
        {
          name: 'it is adaptive: sorted input costs n - 1 comparisons and no moves',
          assert: function (stableSort, api) {
            const items = [];
            for (let i = 0; i < 1000; i += 1) items.push(i * 3);

            const result = stableSort(items, function (a, b) { return a - b; });
            api.assert.deepEqual(result.sorted, items, 'sorted input comes back unchanged');
            api.assert.atMost(result.stats.comparisons, 999,
              'a sorted input needs one comparison per element after the first');
            api.assert.equal(result.stats.moves, 0, 'nothing needs moving');
          }
        },
        {
          name: 'the counters are real: reversed input pays for every inversion',
          assert: function (stableSort, api) {
            const items = [];
            for (let i = 0; i < 200; i += 1) items.push(200 - i);

            const result = stableSort(items, function (a, b) { return a - b; });
            api.assert.equal(result.sorted[0], 1, 'first element');
            api.assert.equal(result.sorted[199], 200, 'last element');
            api.assert.atLeast(result.stats.comparisons, 19900,
              'reversed input has n(n-1)/2 = 19 900 inversions and each costs a comparison');
            api.assert.atLeast(result.stats.moves, 19900, 'every inversion is also a shift');
          }
        }
      ]
    }],

    'merge-sort': [{
      id: 'bottom-up-one-buffer',
      title: 'bottom-up merge sort with exactly one scratch buffer',
      prompt: 'mergeSort(items, compare, allocate) must return { sorted, stats }, where stats is ' +
        '{ comparisons, moves }. Sort iteratively, bottom-up: merge adjacent runs of width 1, then ' +
        '2, then 4, until one run covers the array. allocate(size) is the ONLY way to obtain a ' +
        'working array, and it must be called exactly once for the whole sort - the classic mistake ' +
        'is allocating inside the merge, which the starter does. The merge must be stable: on a tie, ' +
        'take from the left run. Lengths that are not powers of two must work.',
      entry: 'mergeSort',
      starter: [
        'function mergeSort(items, compare, allocate) {',
        '  let comparisons = 0;',
        '  let moves = 0;',
        '',
        '  // top-down, and it allocates a fresh buffer for every single merge',
        '  function sort(list) {',
        '    if (list.length <= 1) return list;',
        '    const middle = list.length >> 1;',
        '    const left = sort(list.slice(0, middle));',
        '    const right = sort(list.slice(middle));',
        '    const out = allocate(list.length);',
        '',
        '    let i = 0;',
        '    let j = 0;',
        '    let k = 0;',
        '    while (i < left.length && j < right.length) {',
        '      comparisons += 1;',
        '      if (compare(right[j], left[i]) < 0) { out[k] = right[j]; j += 1; }',
        '      else { out[k] = left[i]; i += 1; }',
        '      moves += 1;',
        '      k += 1;',
        '    }',
        '    while (i < left.length) { out[k] = left[i]; i += 1; k += 1; moves += 1; }',
        '    while (j < right.length) { out[k] = right[j]; j += 1; k += 1; moves += 1; }',
        '    return out;',
        '  }',
        '',
        '  const sorted = sort(items.slice());',
        '  return { sorted: sorted, stats: { comparisons: comparisons, moves: moves } };',
        '}'
      ].join('\n'),
      solution: [
        'function mergeSort(items, compare, allocate) {',
        '  const n = items.length;',
        '  let source = items.slice();',
        '  let comparisons = 0;',
        '  let moves = 0;',
        '  if (n <= 1) return { sorted: source, stats: { comparisons: 0, moves: 0 } };',
        '',
        '  // one buffer for the whole sort; the two arrays swap roles each pass',
        '  let target = allocate(n);',
        '',
        '  function merge(from, mid, to) {',
        '    let i = from;',
        '    let j = mid;',
        '    for (let k = from; k < to; k += 1) {',
        '      if (i >= mid) { target[k] = source[j]; j += 1; }',
        '      else if (j >= to) { target[k] = source[i]; i += 1; }',
        '      else {',
        '        comparisons += 1;',
        '        // strictly less, so an equal right element never overtakes a left one',
        '        if (compare(source[j], source[i]) < 0) { target[k] = source[j]; j += 1; }',
        '        else { target[k] = source[i]; i += 1; }',
        '      }',
        '      moves += 1;',
        '    }',
        '  }',
        '',
        '  for (let width = 1; width < n; width *= 2) {',
        '    for (let from = 0; from < n; from += 2 * width) {',
        '      const mid = Math.min(from + width, n);',
        '      const to = Math.min(from + 2 * width, n);',
        '      if (mid < to) merge(from, mid, to);',
        '      else for (let k = from; k < to; k += 1) { target[k] = source[k]; moves += 1; }',
        '    }',
        '    const held = source;',
        '    source = target;',
        '    target = held;',
        '  }',
        '',
        '  return { sorted: source, stats: { comparisons: comparisons, moves: moves } };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it sorts, at every length including the awkward ones',
          assert: function (mergeSort, api) {
            const random = api.rng;
            const byValue = function (a, b) { return a - b; };
            const allocate = function (size) { return new Array(size); };
            const lengths = [0, 1, 2, 3, 7, 999, 1000, 1024, 1025];

            lengths.forEach(function (n) {
              const items = [];
              for (let i = 0; i < n; i += 1) items.push(random.int(5000));
              const result = mergeSort(items, byValue, allocate);
              const expected = items.slice().sort(byValue);
              api.assert.equal(result.sorted.length, n, 'length ' + n);
              for (let i = 0; i < n; i += 1) {
                api.assert.equal(result.sorted[i], expected[i], 'n = ' + n + ' at index ' + i);
              }
            });
          }
        },
        {
          name: 'it allocates exactly one working array',
          assert: function (mergeSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 1000; i += 1) items.push(random.int(1000));

            let calls = 0;
            let widest = 0;
            const allocate = function (size) {
              calls += 1;
              widest = Math.max(widest, size);
              return new Array(size);
            };

            const result = mergeSort(items, function (a, b) { return a - b; }, allocate);
            api.assert.equal(result.sorted.length, 1000, 'still sorts 1 000 elements');
            api.assert.equal(calls, 1, 'allocate was called ' + calls + ' times; the schedule needs one buffer');
            api.assert.atMost(widest, 1000, 'the buffer is at most n elements wide');
          }
        },
        {
          name: 'the merge is stable',
          assert: function (mergeSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 800; i += 1) items.push({ key: random.int(10), tag: i });

            const result = mergeSort(items, function (a, b) { return a.key - b.key; },
              function (size) { return new Array(size); });

            for (let i = 1; i < result.sorted.length; i += 1) {
              const before = result.sorted[i - 1];
              const here = result.sorted[i];
              api.assert.ok(before.key <= here.key, 'sorted at ' + i);
              if (before.key === here.key) {
                api.assert.ok(before.tag < here.tag, 'ties reordered at index ' + i);
              }
            }
          }
        },
        {
          name: 'the comparison count matches a level-by-level schedule',
          assert: function (mergeSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 2000; i += 1) items.push(random.int(100000));

            const result = mergeSort(items, function (a, b) { return a - b; },
              function (size) { return new Array(size); });

            const levels = Math.ceil(Math.log2(2000));
            api.assert.atMost(result.stats.comparisons, 2000 * levels,
              'at most n comparisons per level, and there are ' + levels + ' levels');
            api.assert.atLeast(result.stats.comparisons, 15000,
              'a comparison sort of 2 000 random elements cannot be under the n log n floor');
            api.assert.equal(result.stats.moves, 2000 * levels,
              'bottom-up writes every element exactly once per level');
          }
        }
      ]
    }],

    'quicksort': [{
      id: 'three-way-partition',
      title: 'three-way quicksort: duplicates must cost nothing',
      prompt: 'quickSort(items, compare) must return { sorted, stats }, where stats is ' +
        '{ comparisons, maxDepth, partitions }. Partition three ways - less than the pivot, equal ' +
        'to it, greater than it - and recurse only into the two outer bands, never into the equal ' +
        'one. Choose the pivot as the median of the first, middle and last element so a sorted ' +
        'input does not go quadratic. maxDepth is the deepest recursion reached; partitions counts ' +
        'the partition calls. The starter is a two-way Lomuto partition, which is correct and ' +
        'catastrophic on repeated keys.',
      entry: 'quickSort',
      starter: [
        'function quickSort(items, compare) {',
        '  const a = items.slice();',
        '  let comparisons = 0;',
        '  let partitions = 0;',
        '  let maxDepth = 0;',
        '',
        '  // the standard three-comparison median: order lo, mid, hi and return the middle',
        '  function medianOfThree(from, to) {',
        '    let lo = from;',
        '    let mid = from + ((to - from) >> 1);',
        '    let hi = to - 1;',
        '    comparisons += 2;',
        '    if (compare(a[mid], a[lo]) < 0) { const swapped = lo; lo = mid; mid = swapped; }',
        '    if (compare(a[hi], a[mid]) < 0) {',
        '      const held = mid;',
        '      mid = hi;',
        '      hi = held;',
        '      comparisons += 1;',
        '      if (compare(a[mid], a[lo]) < 0) { const again = lo; lo = mid; mid = again; }',
        '    }',
        '    return mid;',
        '  }',
        '',
        '  // two bands only: every element equal to the pivot is partitioned again, and again',
        '  function sort(from, to, depth) {',
        '    maxDepth = Math.max(maxDepth, depth);',
        '    if (to - from <= 1) return;',
        '    partitions += 1;',
        '',
        '    const chosen = medianOfThree(from, to);',
        '    const pivot = a[chosen];',
        '    a[chosen] = a[to - 1];',
        '    a[to - 1] = pivot;',
        '',
        '    let boundary = from;',
        '    for (let i = from; i < to - 1; i += 1) {',
        '      comparisons += 1;',
        '      if (compare(a[i], pivot) < 0) {',
        '        const held = a[i];',
        '        a[i] = a[boundary];',
        '        a[boundary] = held;',
        '        boundary += 1;',
        '      }',
        '    }',
        '    a[to - 1] = a[boundary];',
        '    a[boundary] = pivot;',
        '',
        '    sort(from, boundary, depth + 1);',
        '    sort(boundary + 1, to, depth + 1);',
        '  }',
        '',
        '  sort(0, a.length, 1);',
        '  return { sorted: a, stats: { comparisons: comparisons, maxDepth: maxDepth, partitions: partitions } };',
        '}'
      ].join('\n'),
      solution: [
        'function quickSort(items, compare) {',
        '  const a = items.slice();',
        '  let comparisons = 0;',
        '  let partitions = 0;',
        '  let maxDepth = 0;',
        '',
        '  function swap(i, j) {',
        '    const held = a[i];',
        '    a[i] = a[j];',
        '    a[j] = held;',
        '  }',
        '',
        '  // the standard three-comparison median: order lo, mid, hi and return the middle',
        '  function medianOfThree(from, to) {',
        '    let lo = from;',
        '    let mid = from + ((to - from) >> 1);',
        '    let hi = to - 1;',
        '    comparisons += 2;',
        '    if (compare(a[mid], a[lo]) < 0) { const swapped = lo; lo = mid; mid = swapped; }',
        '    if (compare(a[hi], a[mid]) < 0) {',
        '      const held = mid;',
        '      mid = hi;',
        '      hi = held;',
        '      comparisons += 1;',
        '      if (compare(a[mid], a[lo]) < 0) { const again = lo; lo = mid; mid = again; }',
        '    }',
        '    return mid;',
        '  }',
        '',
        '  // Dijkstra\'s Dutch national flag: [from, lt) < pivot, [lt, i) == pivot, [gt, to) > pivot',
        '  function sort(from, to, depth) {',
        '    maxDepth = Math.max(maxDepth, depth);',
        '    if (to - from <= 1) return;',
        '    partitions += 1;',
        '',
        '    const pivot = a[medianOfThree(from, to)];',
        '    let lt = from;',
        '    let i = from;',
        '    let gt = to;',
        '',
        '    while (i < gt) {',
        '      comparisons += 1;',
        '      const order = compare(a[i], pivot);',
        '      if (order < 0) { swap(lt, i); lt += 1; i += 1; }',
        '      else if (order > 0) { gt -= 1; swap(i, gt); }',
        '      else i += 1;',
        '    }',
        '',
        '    // the equal band is finished; only the two outer bands are recursed into',
        '    sort(from, lt, depth + 1);',
        '    sort(gt, to, depth + 1);',
        '  }',
        '',
        '  sort(0, a.length, 1);',
        '  return { sorted: a, stats: { comparisons: comparisons, maxDepth: maxDepth, partitions: partitions } };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it sorts random, sorted and reversed input',
          assert: function (quickSort, api) {
            const random = api.rng;
            const byValue = function (a, b) { return a - b; };

            const shapes = [];
            const shuffled = [];
            for (let i = 0; i < 500; i += 1) shuffled.push(random.int(10000));
            shapes.push(shuffled);
            const ascending = [];
            for (let i = 0; i < 500; i += 1) ascending.push(i * 2);
            shapes.push(ascending);
            const descending = [];
            for (let i = 0; i < 500; i += 1) descending.push(1000 - i * 2);
            shapes.push(descending);

            shapes.forEach(function (items, index) {
              const result = quickSort(items, byValue);
              const expected = items.slice().sort(byValue);
              api.assert.deepEqual(result.sorted, expected, 'shape ' + index);
            });
          }
        },
        {
          name: '2 000 identical values cost a linear pass, not a quadratic one',
          assert: function (quickSort, api) {
            const items = [];
            for (let i = 0; i < 2000; i += 1) items.push(7);

            const result = quickSort(items, function (a, b) { return a - b; });
            api.assert.equal(result.sorted.length, 2000, 'element count');
            api.assert.equal(result.sorted[1999], 7, 'still all sevens');
            api.assert.atMost(result.stats.comparisons, 10000,
              'one pass puts every equal element in the middle band; got ' + result.stats.comparisons);
            api.assert.atMost(result.stats.maxDepth, 4,
              'there is nothing left to recurse into; got depth ' + result.stats.maxDepth);
            api.assert.atMost(result.stats.partitions, 3, 'one partition should finish the array');
          }
        },
        {
          name: 'few distinct keys stay near n log(distinct), not n squared',
          assert: function (quickSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 2000; i += 1) items.push(random.int(10));

            const result = quickSort(items, function (a, b) { return a - b; });
            const expected = items.slice().sort(function (a, b) { return a - b; });
            api.assert.deepEqual(result.sorted, expected, 'sorted');
            api.assert.atMost(result.stats.comparisons, 40000,
              'ten distinct keys need about n log2 10 comparisons; got ' + result.stats.comparisons);
            api.assert.atMost(result.stats.maxDepth, 40, 'depth ' + result.stats.maxDepth);
          }
        },
        {
          name: 'the comparator is the only order it uses',
          assert: function (quickSort, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 400; i += 1) items.push({ weight: random.int(200) });

            const result = quickSort(items, function (a, b) { return b.weight - a.weight; });
            api.assert.equal(result.sorted.length, 400, 'element count');
            for (let i = 1; i < result.sorted.length; i += 1) {
              api.assert.ok(result.sorted[i - 1].weight >= result.sorted[i].weight,
                'descending by weight at index ' + i);
            }
          }
        }
      ]
    }]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));

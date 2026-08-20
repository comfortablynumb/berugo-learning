/**
 * Graded exercises for the library and non-comparison sorts (M10.4-M10.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'library-sorts': [{
      id: 'timsort-run-plan',
      title: 'minrun and natural runs: the front half of Timsort',
      prompt: 'runPlan(items, compare) must return { minRun, runs, sorted }. minRun follows Timsort\'s ' +
        'rule exactly: while n >= 32, take the top five bits of n and add 1 if any bit below them is ' +
        'set, so the answer always lands in [16, 32]; below 32 the answer is n itself. Then walk the ' +
        'array once collecting NATURAL runs - a strictly descending run is reversed in place, which ' +
        'is why a reversed input is one run and not n of them - extend any run shorter than minRun ' +
        'with a binary insertion sort, and merge the runs stably. runs is the list of run lengths ' +
        'you produced, in order. The starter uses a fixed minRun and never reverses a descending run.',
      entry: 'runPlan',
      starter: [
        'function runPlan(items, compare) {',
        '  const a = items.slice();',
        '  const n = a.length;',
        '  const minRun = n < 32 ? n : 32;   // a constant, not the rule',
        '  const runs = [];',
        '',
        '  let at = 0;',
        '  while (at < n) {',
        '    let end = at + 1;',
        '    // ascending runs only: a descending stretch reads as a run of one',
        '    while (end < n && compare(a[end - 1], a[end]) <= 0) end += 1;',
        '    while (end - at < minRun && end < n) end += 1;',
        '    for (let i = at + 1; i < end; i += 1) {',
        '      const value = a[i];',
        '      let j = i - 1;',
        '      while (j >= at && compare(a[j], value) > 0) { a[j + 1] = a[j]; j -= 1; }',
        '      a[j + 1] = value;',
        '    }',
        '    runs.push(end - at);',
        '    at = end;',
        '  }',
        '',
        '  const sorted = a.slice().sort(compare);',
        '  return { minRun: minRun, runs: runs, sorted: sorted };',
        '}'
      ].join('\n'),
      solution: [
        'function runPlan(items, compare) {',
        '  const a = items.slice();',
        '  const n = a.length;',
        '',
        '  function minRunLength(count) {',
        '    let remaining = count;',
        '    let carry = 0;',
        '    while (remaining >= 32) {',
        '      carry |= remaining & 1;',
        '      remaining >>= 1;',
        '    }',
        '    return remaining + carry;',
        '  }',
        '',
        '  function reverse(from, to) {',
        '    let i = from;',
        '    let j = to - 1;',
        '    while (i < j) {',
        '      const held = a[i];',
        '      a[i] = a[j];',
        '      a[j] = held;',
        '      i += 1;',
        '      j -= 1;',
        '    }',
        '  }',
        '',
        '  // extend a run to minRun: binary insertion keeps ties in place, so it stays stable',
        '  function insertInto(from, sortedTo, to) {',
        '    for (let i = sortedTo; i < to; i += 1) {',
        '      const value = a[i];',
        '      let lo = from;',
        '      let hi = i;',
        '      while (lo < hi) {',
        '        const mid = lo + ((hi - lo) >> 1);',
        '        if (compare(value, a[mid]) < 0) hi = mid; else lo = mid + 1;',
        '      }',
        '      for (let j = i; j > lo; j -= 1) a[j] = a[j - 1];',
        '      a[lo] = value;',
        '    }',
        '  }',
        '',
        '  function detect(at) {',
        '    let end = at + 1;',
        '    if (end === n) return end;',
        '    if (compare(a[end], a[at]) < 0) {',
        '      while (end < n && compare(a[end], a[end - 1]) < 0) end += 1;',
        '      reverse(at, end);',
        '      return end;',
        '    }',
        '    while (end < n && compare(a[end], a[end - 1]) >= 0) end += 1;',
        '    return end;',
        '  }',
        '',
        '  const minRun = minRunLength(n);',
        '  const runs = [];',
        '  const bounds = [];',
        '  let at = 0;',
        '  while (at < n) {',
        '    const natural = detect(at);',
        '    const end = Math.min(n, Math.max(natural, at + minRun));',
        '    if (end > natural) insertInto(at, natural, end);',
        '    runs.push(end - at);',
        '    bounds.push([at, end]);',
        '    at = end;',
        '  }',
        '',
        '  function merge(left, right) {',
        '    const out = [];',
        '    let i = 0;',
        '    let j = 0;',
        '    while (i < left.length && j < right.length) {',
        '      if (compare(right[j], left[i]) < 0) { out.push(right[j]); j += 1; }',
        '      else { out.push(left[i]); i += 1; }',
        '    }',
        '    while (i < left.length) { out.push(left[i]); i += 1; }',
        '    while (j < right.length) { out.push(right[j]); j += 1; }',
        '    return out;',
        '  }',
        '',
        '  let pending = bounds.map(function (pair) { return a.slice(pair[0], pair[1]); });',
        '  while (pending.length > 1) {',
        '    const next = [];',
        '    for (let i = 0; i < pending.length; i += 2) {',
        '      if (i + 1 < pending.length) next.push(merge(pending[i], pending[i + 1]));',
        '      else next.push(pending[i]);',
        '    }',
        '    pending = next;',
        '  }',
        '',
        '  return { minRun: minRun, runs: runs, sorted: pending.length ? pending[0] : [] };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'minRun follows the rule, and always lands in [16, 32]',
          assert: function (runPlan, api) {
            const byValue = function (a, b) { return a - b; };
            const expected = { 10: 10, 63: 32, 64: 16, 65: 17, 1000: 32, 2048: 16, 20000: 20 };

            Object.keys(expected).forEach(function (key) {
              const n = Number(key);
              const items = [];
              for (let i = 0; i < n; i += 1) items.push((i * 7919) % 10007);
              api.assert.equal(runPlan(items, byValue).minRun, expected[key], 'minRun for n = ' + n);
            });

            for (let n = 64; n < 400; n += 7) {
              const items = [];
              for (let i = 0; i < n; i += 1) items.push((i * 31) % 97);
              const minRun = runPlan(items, byValue).minRun;
              api.assert.ok(minRun >= 16 && minRun <= 32, 'minRun ' + minRun + ' out of range at n = ' + n);
            }
          }
        },
        {
          name: 'a strictly descending input is one run, not two thousand',
          assert: function (runPlan, api) {
            const byValue = function (a, b) { return a - b; };

            const descending = [];
            for (let i = 0; i < 2000; i += 1) descending.push(2000 - i);
            const down = runPlan(descending, byValue);
            api.assert.deepEqual(down.runs, [2000], 'a descending run is reversed in place');
            api.assert.equal(down.sorted[0], 1, 'and it still sorts');

            const ascending = [];
            for (let i = 0; i < 2000; i += 1) ascending.push(i * 2);
            api.assert.deepEqual(runPlan(ascending, byValue).runs, [2000], 'an ascending input is one run');
          }
        },
        {
          name: 'every run but the last reaches minRun, and the runs cover the array',
          assert: function (runPlan, api) {
            const random = api.rng;
            const byValue = function (a, b) { return a - b; };
            const items = [];
            for (let i = 0; i < 3001; i += 1) items.push(random.int(100000));

            const plan = runPlan(items, byValue);
            let total = 0;
            plan.runs.forEach(function (length, index) {
              total += length;
              if (index < plan.runs.length - 1) {
                api.assert.atLeast(length, plan.minRun, 'run ' + index + ' is shorter than minRun');
              }
            });
            api.assert.equal(total, 3001, 'the runs must cover every element');
            api.assert.deepEqual(plan.sorted, items.slice().sort(byValue), 'sorted');
          }
        },
        {
          name: 'the whole plan is stable',
          assert: function (runPlan, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 1500; i += 1) items.push({ key: random.int(12), tag: i });

            const plan = runPlan(items, function (a, b) { return a.key - b.key; });
            api.assert.equal(plan.sorted.length, 1500, 'element count');
            for (let i = 1; i < plan.sorted.length; i += 1) {
              const before = plan.sorted[i - 1];
              const here = plan.sorted[i];
              api.assert.ok(before.key <= here.key, 'sorted at ' + i);
              if (before.key === here.key) api.assert.ok(before.tag < here.tag, 'ties reordered at ' + i);
            }
          }
        }
      ]
    }],

    'non-comparison-sorts': [{
      id: 'lsd-radix-signed',
      title: 'LSD radix over signed keys, and the stability it depends on',
      prompt: 'radixSort(records, digitBits) must sort an array of { key, tag } by the 32-bit SIGNED ' +
        'integer key and return { sorted, passes, bucketCount }. Use least-significant-digit radix ' +
        'with digits of digitBits bits: ceil(32 / digitBits) passes, 2^digitBits counters per pass, ' +
        'and a counting sort inside each pass. Two things are graded beyond the order. Every pass ' +
        'must be STABLE, because LSD depends on the previous pass surviving this one. And the keys ' +
        'are two\'s-complement: read as unsigned, every negative number sorts after every positive ' +
        'one, so the top digit needs the sign bit flipped. The starter does neither.',
      entry: 'radixSort',
      starter: [
        'function radixSort(records, digitBits) {',
        '  const RADIX = 256;                 // digitBits is ignored',
        '  const passes = 4;',
        '  let source = records.slice();',
        '  let target = new Array(source.length);',
        '',
        '  for (let pass = 0; pass < passes; pass += 1) {',
        '    const shift = pass * 8;',
        '    const counts = new Array(RADIX).fill(0);',
        '    // unsigned: the sign bit is just another bit, so negatives land at the top',
        '    for (let i = 0; i < source.length; i += 1) {',
        '      counts[(source[i].key >>> shift) & (RADIX - 1)] += 1;',
        '    }',
        '',
        '    let running = 0;',
        '    for (let digit = 0; digit < RADIX; digit += 1) {',
        '      const here = counts[digit];',
        '      counts[digit] = running;',
        '      running += here;',
        '    }',
        '',
        '    for (let i = 0; i < source.length; i += 1) {',
        '      const digit = (source[i].key >>> shift) & (RADIX - 1);',
        '      target[counts[digit]] = source[i];',
        '      counts[digit] += 1;',
        '    }',
        '',
        '    const held = source;',
        '    source = target;',
        '    target = held;',
        '  }',
        '',
        '  return { sorted: source, passes: passes, bucketCount: RADIX };',
        '}'
      ].join('\n'),
      solution: [
        'function radixSort(records, digitBits) {',
        '  const bits = digitBits || 8;',
        '  const radix = 1 << bits;',
        '  const passes = Math.ceil(32 / bits);',
        '  const n = records.length;',
        '  let source = records.slice();',
        '  let target = new Array(n);',
        '',
        '  // flip the sign bit once: the keys become unsigned in the same order',
        '  function digitOf(key, pass) {',
        '    const flipped = (key ^ 0x80000000) >>> 0;',
        '    return Math.floor(flipped / Math.pow(2, pass * bits)) % radix;',
        '  }',
        '',
        '  for (let pass = 0; pass < passes; pass += 1) {',
        '    const counts = new Array(radix).fill(0);',
        '    for (let i = 0; i < n; i += 1) counts[digitOf(source[i].key, pass)] += 1;',
        '',
        '    // exclusive prefix sum: bucket STARTS, not ends',
        '    let running = 0;',
        '    for (let digit = 0; digit < radix; digit += 1) {',
        '      const here = counts[digit];',
        '      counts[digit] = running;',
        '      running += here;',
        '    }',
        '',
        '    // forward scan with a post-increment cursor is what makes the pass stable',
        '    for (let i = 0; i < n; i += 1) {',
        '      const digit = digitOf(source[i].key, pass);',
        '      target[counts[digit]] = source[i];',
        '      counts[digit] += 1;',
        '    }',
        '',
        '    const held = source;',
        '    source = target;',
        '    target = held;',
        '  }',
        '',
        '  return { sorted: source, passes: passes, bucketCount: radix };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it sorts signed keys, negatives included',
          assert: function (radixSort, api) {
            const random = api.rng;
            const records = [];
            for (let i = 0; i < 4000; i += 1) {
              records.push({ key: random.int(2000000) - 1000000, tag: i });
            }
            records.push({ key: -2147483648, tag: 4000 });
            records.push({ key: 2147483647, tag: 4001 });
            records.push({ key: 0, tag: 4002 });

            const result = radixSort(records, 8);
            const expected = records.slice().sort(function (a, b) { return a.key - b.key; });
            api.assert.equal(result.sorted.length, expected.length, 'element count');
            for (let i = 0; i < expected.length; i += 1) {
              api.assert.equal(result.sorted[i].key, expected[i].key, 'key at index ' + i);
            }
          }
        },
        {
          name: 'every pass is stable, so ties keep their input order',
          assert: function (radixSort, api) {
            const random = api.rng;
            const records = [];
            for (let i = 0; i < 3000; i += 1) {
              records.push({ key: random.int(40) - 20, tag: i });
            }

            const result = radixSort(records, 8);
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
          name: 'the digit width sets the pass count and the table size',
          assert: function (radixSort, api) {
            const random = api.rng;
            const records = [];
            for (let i = 0; i < 1500; i += 1) records.push({ key: random.int(1000000) - 500000, tag: i });
            const expected = records.slice().sort(function (a, b) { return a.key - b.key; });

            [[4, 8, 16], [16, 4, 256], [2, 2, 65536]].forEach(function (row) {
              const bits = row[0];
              const result = radixSort(records, bits);
              api.assert.equal(result.passes, Math.ceil(32 / bits), 'passes at ' + bits + '-bit digits');
              api.assert.equal(result.bucketCount, 1 << bits, 'table size at ' + bits + '-bit digits');
              for (let i = 0; i < expected.length; i += 1) {
                api.assert.equal(result.sorted[i].key, expected[i].key,
                  bits + '-bit digits, index ' + i);
              }
            });
          }
        },
        {
          name: 'a wide key range is where an unstable pass stops sorting at all',
          assert: function (radixSort, api) {
            const random = api.rng;
            const records = [];
            for (let i = 0; i < 2000; i += 1) records.push({ key: random.int(1000000), tag: i });

            const result = radixSort(records, 8);
            for (let i = 1; i < result.sorted.length; i += 1) {
              api.assert.ok(result.sorted[i - 1].key <= result.sorted[i].key,
                'out of order at index ' + i + ': ' + result.sorted[i - 1].key + ' then ' + result.sorted[i].key);
            }
            api.assert.equal(result.sorted.length, 2000, 'no record may be dropped');
          }
        }
      ]
    }],

    'selection-and-order': [{
      id: 'quickselect-one-side',
      title: 'quickselect: recurse into one side, and survive duplicates',
      prompt: 'select(values, k) must return { value, comparisons }: the k-th smallest value, 0-based, ' +
        'of a numeric array, and the number of element comparisons it made. Partition three ways ' +
        'around a pivot and recurse into the ONE band that can hold rank k - never into both, and ' +
        'never into the equal band. That is what turns n log n into about 2n. The equal band matters ' +
        'as much as the one-sided recursion: a two-way partition on an array of identical values ' +
        'makes no progress at all. The starter sorts the whole array and indexes it, which is correct ' +
        'and answers a question nobody asked.',
      entry: 'select',
      starter: [
        'function select(values, k) {',
        '  const a = values.slice();',
        '  let comparisons = 0;',
        '',
        '  // a full bottom-up merge sort: n log n comparisons for one element',
        '  let source = a;',
        '  let target = new Array(a.length);',
        '  for (let width = 1; width < a.length; width *= 2) {',
        '    for (let from = 0; from < a.length; from += 2 * width) {',
        '      const mid = Math.min(from + width, a.length);',
        '      const to = Math.min(from + 2 * width, a.length);',
        '      let i = from;',
        '      let j = mid;',
        '      for (let at = from; at < to; at += 1) {',
        '        if (i >= mid) { target[at] = source[j]; j += 1; }',
        '        else if (j >= to) { target[at] = source[i]; i += 1; }',
        '        else {',
        '          comparisons += 1;',
        '          if (source[j] < source[i]) { target[at] = source[j]; j += 1; }',
        '          else { target[at] = source[i]; i += 1; }',
        '        }',
        '      }',
        '    }',
        '    const held = source;',
        '    source = target;',
        '    target = held;',
        '  }',
        '',
        '  return { value: source[k], comparisons: comparisons };',
        '}'
      ].join('\n'),
      solution: [
        'function select(values, k) {',
        '  const a = values.slice();',
        '  let comparisons = 0;',
        '  let from = 0;',
        '  let to = a.length;',
        '',
        '  function swap(i, j) {',
        '    const held = a[i];',
        '    a[i] = a[j];',
        '    a[j] = held;',
        '  }',
        '',
        '  function medianOfThree(lo, hi) {',
        '    let first = lo;',
        '    let middle = lo + ((hi - lo) >> 1);',
        '    let last = hi - 1;',
        '    comparisons += 2;',
        '    if (a[middle] < a[first]) { const held = first; first = middle; middle = held; }',
        '    if (a[last] < a[middle]) {',
        '      const held = middle;',
        '      middle = last;',
        '      last = held;',
        '      comparisons += 1;',
        '      if (a[middle] < a[first]) { const again = first; first = middle; middle = again; }',
        '    }',
        '    return middle;',
        '  }',
        '',
        '  // the loop replaces the recursion: only one band can hold rank k',
        '  while (to - from > 1) {',
        '    const pivot = a[medianOfThree(from, to)];',
        '    let lt = from;',
        '    let i = from;',
        '    let gt = to;',
        '',
        '    while (i < gt) {',
        '      comparisons += 1;',
        '      if (a[i] < pivot) { swap(lt, i); lt += 1; i += 1; }',
        '      else {',
        '        comparisons += 1;',
        '        if (pivot < a[i]) { gt -= 1; swap(i, gt); }',
        '        else i += 1;',
        '      }',
        '    }',
        '',
        '    if (k < lt) to = lt;',
        '    else if (k >= gt) from = gt;',
        '    else return { value: pivot, comparisons: comparisons };',
        '  }',
        '',
        '  return { value: a[from], comparisons: comparisons };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with a sorted copy at every rank',
          assert: function (select, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 200; i += 1) values.push(random.int(500));
            const sorted = values.slice().sort(function (a, b) { return a - b; });

            for (let k = 0; k < values.length; k += 1) {
              api.assert.equal(select(values, k).value, sorted[k], 'rank ' + k);
            }
            api.assert.equal(values.length, 200, 'the input must not be mutated');
          }
        },
        {
          name: '20 000 identical values are one partition, not a quadratic walk',
          assert: function (select, api) {
            const values = [];
            for (let i = 0; i < 20000; i += 1) values.push(42);

            const result = select(values, 10000);
            api.assert.equal(result.value, 42, 'the answer');
            api.assert.atMost(result.comparisons, 60000,
              'the equal band should finish the array in one pass; got ' + result.comparisons);
          }
        },
        {
          name: 'five distinct keys over 20 000 elements stay linear',
          assert: function (select, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 20000; i += 1) values.push(random.int(5));
            const sorted = values.slice().sort(function (a, b) { return a - b; });

            [0, 5000, 12345, 19999].forEach(function (k) {
              const result = select(values, k);
              api.assert.equal(result.value, sorted[k], 'rank ' + k);
              api.assert.atMost(result.comparisons, 150000,
                'rank ' + k + ' cost ' + result.comparisons + ' comparisons on five distinct keys');
            });
          }
        },
        {
          name: 'the median of 20 000 random values costs a constant times n, not n log n',
          assert: function (select, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 20000; i += 1) values.push(random.int(1000000));
            const sorted = values.slice().sort(function (a, b) { return a - b; });

            const result = select(values, 10000);
            api.assert.equal(result.value, sorted[10000], 'the median');
            api.assert.atMost(result.comparisons, 200000,
              'sorting to select costs about 13n = 260 000 here; selection should be far under it. Got ' +
                result.comparisons);
          }
        }
      ]
    }]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));

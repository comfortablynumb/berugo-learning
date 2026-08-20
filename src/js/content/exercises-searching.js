/**
 * Graded exercises for the searching and practice sections (M10.7-M10.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'binary-search': [{
      id: 'lower-bound-in-range',
      title: 'lower bound, in ceil(log2 n) probes, without reading past the end',
      prompt: 'lowerBound(items, target) must return { index, probes }: the first position at which ' +
        'target could be inserted and keep items sorted - that is, the count of elements strictly ' +
        'less than target - and the number of array elements it read. Maintain the half-open ' +
        'interval [lo, hi) with hi starting at items.length, so the answer is always inside it and ' +
        'the loop ends when the interval is empty. Two things are graded past the answer: at most ' +
        'ceil(log2 n) probes, and NO read outside [0, n). The starter is the inclusive-loop variant, ' +
        'which returns the right answer for every input and reads items[n] while doing it - a defect ' +
        'JavaScript hides behind undefined and C does not hide at all.',
      entry: 'lowerBound',
      starter: [
        'function lowerBound(items, target) {',
        '  let probes = 0;',
        '  let lo = 0;',
        '  let hi = items.length;   // inclusive loop over an exclusive bound',
        '',
        '  while (lo <= hi) {',
        '    const mid = lo + ((hi - lo) >> 1);',
        '    probes += 1;',
        '    if (items[mid] < target) lo = mid + 1;',
        '    else hi = mid - 1;',
        '  }',
        '',
        '  return { index: lo, probes: probes };',
        '}'
      ].join('\n'),
      solution: [
        'function lowerBound(items, target) {',
        '  let probes = 0;',
        '  let lo = 0;',
        '  let hi = items.length;',
        '',
        '  // invariant: every index below lo is < target, every index at or above hi is >= target',
        '  while (lo < hi) {',
        '    const mid = lo + ((hi - lo) >> 1);   // in [lo, hi) whenever lo < hi',
        '    probes += 1;',
        '    if (items[mid] < target) lo = mid + 1;',
        '    else hi = mid;',
        '  }',
        '',
        '  return { index: lo, probes: probes };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it agrees with a linear scan, present keys and absent ones alike',
          assert: function (lowerBound, api) {
            const random = api.rng;
            const items = [];
            for (let i = 0; i < 2000; i += 1) items.push(random.int(600) * 2);
            items.sort(function (a, b) { return a - b; });

            const targets = [-5, 0, 1, 1199, 1200, 5000];
            for (let i = 0; i < 300; i += 1) targets.push(random.int(1300) - 10);

            targets.forEach(function (target) {
              let expected = 0;
              while (expected < items.length && items[expected] < target) expected += 1;
              api.assert.equal(lowerBound(items, target).index, expected, 'target ' + target);
            });

            api.assert.equal(lowerBound([], 7).index, 0, 'an empty array answers 0');
          }
        },
        {
          name: 'it uses at most ceil(log2 n) probes',
          assert: function (lowerBound, api) {
            const items = [];
            for (let i = 0; i < 10000; i += 1) items.push(i * 3);
            const bound = Math.ceil(Math.log2(10000));

            [0, 1, 2, 14997, 29997, 30000, -1].forEach(function (target) {
              const result = lowerBound(items, target);
              api.assert.atMost(result.probes, bound,
                'target ' + target + ' took ' + result.probes + ' probes; the bound is ' + bound);
            });
          }
        },
        {
          name: 'it never reads an index outside [0, n)',
          assert: function (lowerBound, api) {
            const backing = [];
            for (let i = 0; i < 1000; i += 1) backing.push(i * 2);

            const outside = [];
            const watched = new Proxy(backing, {
              get: function (target, property) {
                if (typeof property === 'string' && /^-?[0-9]+$/.test(property)) {
                  const index = Number(property);
                  if (index < 0 || index >= target.length) outside.push(index);
                }
                return target[property];
              }
            });

            [-4, 0, 1, 999, 1998, 1999, 2000, 100000].forEach(function (target) {
              lowerBound(watched, target);
            });
            api.assert.deepEqual(outside, [],
              'these indices were read and do not exist: ' + api.assert.show(outside));
          }
        },
        {
          name: 'the awkward shapes: one element, two elements, all equal',
          assert: function (lowerBound, api) {
            api.assert.equal(lowerBound([5], 4).index, 0, 'below the only element');
            api.assert.equal(lowerBound([5], 5).index, 0, 'equal to the only element');
            api.assert.equal(lowerBound([5], 6).index, 1, 'above the only element');
            api.assert.equal(lowerBound([2, 4], 3).index, 1, 'between two elements');

            const flat = [];
            for (let i = 0; i < 500; i += 1) flat.push(9);
            api.assert.equal(lowerBound(flat, 9).index, 0, 'the first of 500 equal keys');
            api.assert.equal(lowerBound(flat, 10).index, 500, 'past 500 equal keys');
          }
        }
      ]
    }],

    'searching-the-answer': [{
      id: 'minimum-feasible-capacity',
      title: 'binary search an answer nobody stored: the smallest capacity that fits',
      prompt: 'minCapacity(weights, days) must return { capacity, checks }: the smallest ship capacity ' +
        'that moves the packages, in order, in at most `days` days, and the number of times it ' +
        'evaluated the feasibility predicate. The array being searched does not exist - the ordered ' +
        'thing is the answer axis, over which "can this capacity finish in time?" is false and then ' +
        'true. The search range is bounded below by the heaviest single package (nothing smaller can ' +
        'carry it) and above by the total weight (one day). Evaluate feasible O(log range) times, not ' +
        'O(range) times. The starter is a binary search with the boundary written by feel rather ' +
        'than from the invariant, and it is wrong by one on inputs that are easy to miss.',
      entry: 'minCapacity',
      starter: [
        'function minCapacity(weights, days) {',
        '  let checks = 0;',
        '',
        '  function feasible(capacity) {',
        '    checks += 1;',
        '    let used = 1;',
        '    let load = 0;',
        '    for (let i = 0; i < weights.length; i += 1) {',
        '      if (load + weights[i] > capacity) { used += 1; load = 0; }',
        '      load += weights[i];',
        '    }',
        '    return used <= days;',
        '  }',
        '',
        '  let lo = 0;',
        '  let hi = 0;',
        '  for (let i = 0; i < weights.length; i += 1) {',
        '    lo = Math.max(lo, weights[i]);',
        '    hi += weights[i];',
        '  }',
        '',
        '  // a closed-interval loop written without its invariant: the feasible branch',
        '  // steps past the candidate it just proved, so the answer can be one too small',
        '  while (lo < hi) {',
        '    const mid = lo + Math.floor((hi - lo) / 2);',
        '    if (feasible(mid)) hi = mid - 1;',
        '    else lo = mid + 1;',
        '  }',
        '',
        '  return { capacity: lo, checks: checks };',
        '}'
      ].join('\n'),
      solution: [
        'function minCapacity(weights, days) {',
        '  let checks = 0;',
        '',
        '  // greedy: fill the day until the next package does not fit, then start a new day',
        '  function feasible(capacity) {',
        '    checks += 1;',
        '    let used = 1;',
        '    let load = 0;',
        '    for (let i = 0; i < weights.length; i += 1) {',
        '      if (load + weights[i] > capacity) { used += 1; load = 0; }',
        '      load += weights[i];',
        '    }',
        '    return used <= days;',
        '  }',
        '',
        '  let lo = 0;',
        '  let hi = 0;',
        '  for (let i = 0; i < weights.length; i += 1) {',
        '    lo = Math.max(lo, weights[i]);',
        '    hi += weights[i];',
        '  }',
        '  if (weights.length === 0) return { capacity: 0, checks: 0 };',
        '',
        '  // first-true over [lo, hi]: lo is the smallest capacity that can hold one package,',
        '  // hi is the whole load in a single day and is always feasible',
        '  while (lo < hi) {',
        '    const mid = lo + Math.floor((hi - lo) / 2);',
        '    if (feasible(mid)) hi = mid;',
        '    else lo = mid + 1;',
        '  }',
        '',
        '  return { capacity: lo, checks: checks };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the worked case: weights 1..10 over 5 days is 15',
          assert: function (minCapacity, api) {
            const weights = [];
            for (let i = 1; i <= 10; i += 1) weights.push(i);

            const result = minCapacity(weights, 5);
            api.assert.equal(result.capacity, 15, 'the answer');
            api.assert.atMost(result.checks, 7,
              'the range is 10..55, so ceil(log2 46) = 6 checks; got ' + result.checks);
            api.assert.atLeast(result.checks, 1, 'the predicate has to be evaluated at least once');
          }
        },
        {
          name: 'it agrees with a full sweep of the range',
          assert: function (minCapacity, api) {
            const random = api.rng;

            for (let trial = 0; trial < 40; trial += 1) {
              const weights = [];
              const count = 3 + random.int(9);
              for (let i = 0; i < count; i += 1) weights.push(1 + random.int(20));
              const days = 1 + random.int(count);

              let lo = 0;
              let total = 0;
              weights.forEach(function (w) { lo = Math.max(lo, w); total += w; });

              let expected = total;
              for (let capacity = lo; capacity <= total; capacity += 1) {
                let used = 1;
                let load = 0;
                for (let i = 0; i < weights.length; i += 1) {
                  if (load + weights[i] > capacity) { used += 1; load = 0; }
                  load += weights[i];
                }
                if (used <= days) { expected = capacity; break; }
              }

              api.assert.equal(minCapacity(weights, days).capacity, expected,
                'trial ' + trial + ' with days = ' + days + ' and weights ' + api.assert.show(weights));
            }
          }
        },
        {
          name: 'the check count is logarithmic in the range, not linear in it',
          assert: function (minCapacity, api) {
            const random = api.rng;
            const weights = [];
            for (let i = 0; i < 10000; i += 1) weights.push(1 + random.int(1000000));

            const result = minCapacity(weights, 37);
            let lo = 0;
            let total = 0;
            weights.forEach(function (w) { lo = Math.max(lo, w); total += w; });
            const bound = Math.ceil(Math.log2(total - lo + 1)) + 1;

            api.assert.atMost(result.checks, bound,
              'a range of ' + (total - lo) + ' needs about ' + bound + ' checks; got ' + result.checks);
            api.assert.ok(result.capacity >= lo && result.capacity <= total, 'the answer is inside the range');
          }
        },
        {
          name: 'the endpoints: one day, and a day per package',
          assert: function (minCapacity, api) {
            const weights = [7, 2, 5, 10, 8];
            const total = 32;

            api.assert.equal(minCapacity(weights, 1).capacity, total, 'one day must carry everything');
            api.assert.equal(minCapacity(weights, 5).capacity, 10,
              'a day per package needs only the heaviest one');
            api.assert.equal(minCapacity(weights, 50).capacity, 10,
              'more days than packages cannot help further - every capacity in range is feasible');
          }
        }
      ]
    }],

    'external-sorting': [{
      id: 'replacement-selection-runs',
      title: 'replacement selection: runs twice the size of memory',
      prompt: 'generateRuns(records, memory) must return an array of runs - each run an array of ' +
        'numbers - produced by replacement selection over a buffer holding at most `memory` records. ' +
        'Fill the buffer, then repeatedly write out the smallest buffered value that is NOT smaller ' +
        'than the last value written, refilling that slot from the input. When no buffered value ' +
        'qualifies, the current run is finished and a new one begins with the whole buffer available ' +
        'again. Every run must come out sorted, and the runs together must hold every input record ' +
        'exactly once. On random input this yields runs of about 2 x memory - Knuth\'s snowplough - ' +
        'and on already-sorted input it yields exactly one run. The starter sorts and flushes.',
      entry: 'generateRuns',
      starter: [
        'function generateRuns(records, memory) {',
        '  const runs = [];',
        '',
        '  // sort-and-flush: every run is exactly one buffer wide, whatever the input looks like',
        '  for (let at = 0; at < records.length; at += memory) {',
        '    const chunk = records.slice(at, at + memory);',
        '    chunk.sort(function (a, b) { return a - b; });',
        '    runs.push(chunk);',
        '  }',
        '',
        '  return runs;',
        '}'
      ].join('\n'),
      solution: [
        'function generateRuns(records, memory) {',
        '  const runs = [];',
        '  const buffer = [];',
        '  let next = 0;',
        '',
        '  while (next < records.length && buffer.length < memory) {',
        '    buffer.push(records[next]);',
        '    next += 1;',
        '  }',
        '',
        '  let current = [];',
        '  let last = -Infinity;',
        '',
        '  while (buffer.length > 0) {',
        '    // the smallest value still eligible for THIS run',
        '    let chosen = -1;',
        '    for (let i = 0; i < buffer.length; i += 1) {',
        '      if (buffer[i] >= last && (chosen === -1 || buffer[i] < buffer[chosen])) chosen = i;',
        '    }',
        '',
        '    // nothing qualifies: the run is over, and every frozen record is eligible again',
        '    if (chosen === -1) {',
        '      runs.push(current);',
        '      current = [];',
        '      last = -Infinity;',
        '      continue;',
        '    }',
        '',
        '    last = buffer[chosen];',
        '    current.push(last);',
        '    if (next < records.length) {',
        '      buffer[chosen] = records[next];',
        '      next += 1;',
        '    } else {',
        '      buffer[chosen] = buffer[buffer.length - 1];',
        '      buffer.pop();',
        '    }',
        '  }',
        '',
        '  if (current.length > 0) runs.push(current);',
        '  return runs;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every run is sorted and the runs hold every record exactly once',
          assert: function (generateRuns, api) {
            const random = api.rng;
            const records = [];
            for (let i = 0; i < 10000; i += 1) records.push(random.int(1000000));

            const runs = generateRuns(records, 100);
            const flat = [];
            runs.forEach(function (run, index) {
              for (let i = 1; i < run.length; i += 1) {
                api.assert.ok(run[i - 1] <= run[i], 'run ' + index + ' is out of order at ' + i);
              }
              run.forEach(function (value) { flat.push(value); });
            });

            api.assert.equal(flat.length, 10000, 'record count');
            flat.sort(function (a, b) { return a - b; });
            const expected = records.slice().sort(function (a, b) { return a - b; });
            for (let i = 0; i < expected.length; i += 1) {
              api.assert.equal(flat[i], expected[i], 'multiset mismatch at ' + i);
            }
          }
        },
        {
          name: 'sorted input is one run, and the whole merge disappears',
          assert: function (generateRuns, api) {
            const records = [];
            for (let i = 0; i < 5000; i += 1) records.push(i * 2);

            const runs = generateRuns(records, 100);
            api.assert.equal(runs.length, 1, 'a sorted input needs no run boundary; got ' + runs.length);
            api.assert.equal(runs[0].length, 5000, 'and the run is the whole input');
          }
        },
        {
          name: 'random input yields runs of about twice memory',
          assert: function (generateRuns, api) {
            const random = api.rng;
            const records = [];
            for (let i = 0; i < 10000; i += 1) records.push(random.int(1000000));

            const runs = generateRuns(records, 100);
            const mean = 10000 / runs.length;
            api.assert.atMost(runs.length, 70,
              'sort-and-flush would give 100 runs; replacement selection should give about 51. Got ' +
                runs.length);
            api.assert.atLeast(mean, 140,
              'mean run length ' + mean.toFixed(1) + ' - the snowplough argument predicts about 2 x 100');
          }
        },
        {
          name: 'reverse-sorted input is the worst case, and it still has to be correct',
          assert: function (generateRuns, api) {
            const records = [];
            for (let i = 0; i < 1000; i += 1) records.push(1000 - i);

            const runs = generateRuns(records, 100);
            api.assert.equal(runs.length, 10, 'each run can only be one buffer wide here');
            runs.forEach(function (run, index) {
              api.assert.equal(run.length, 100, 'run ' + index + ' length');
              for (let i = 1; i < run.length; i += 1) {
                api.assert.ok(run[i - 1] <= run[i], 'run ' + index + ' out of order at ' + i);
              }
            });
          }
        }
      ]
    }],

    'sorting-in-practice': [{
      id: 'total-order-comparator',
      title: 'an ORDER BY that survives pagination',
      prompt: 'orderBy(rows, fields) must return a new sorted array. fields is a list like ' +
        '["-score", "name", "id"]: a leading minus means descending, and the fields are applied in ' +
        'order as a tie-break chain. Numbers compare numerically - the default comparator compares ' +
        'string forms, which is why [1, 2, 10] sorts to [1, 10, 2] - and strings compare by code ' +
        'unit. Two things are graded beyond the order. The chain must be followed to the end, not ' +
        'just the first field. And the result must be a TOTAL order: shuffling the input and sorting ' +
        'again must produce the identical sequence, because two pages of a paginated query are two ' +
        'separate sorts. The starter sorts on the first field only, as strings.',
      entry: 'orderBy',
      starter: [
        'function orderBy(rows, fields) {',
        '  const descending = fields[0].charAt(0) === "-";',
        '  const field = descending ? fields[0].slice(1) : fields[0];',
        '  const out = rows.slice();',
        '',
        '  // one field, and the default comparator\'s string ordering',
        '  out.sort(function (a, b) {',
        '    const left = String(a[field]);',
        '    const right = String(b[field]);',
        '    if (left < right) return -1;',
        '    return left > right ? 1 : 0;',
        '  });',
        '',
        '  if (descending) out.reverse();',
        '  return out;',
        '}'
      ].join('\n'),
      solution: [
        'function orderBy(rows, fields) {',
        '  const plan = fields.map(function (entry) {',
        '    const descending = entry.charAt(0) === "-";',
        '    return { field: descending ? entry.slice(1) : entry, sign: descending ? -1 : 1 };',
        '  });',
        '',
        '  function compareValues(left, right) {',
        '    if (typeof left === "number" && typeof right === "number") return left - right;',
        '    const a = String(left);',
        '    const b = String(right);',
        '    if (a < b) return -1;',
        '    return a > b ? 1 : 0;',
        '  }',
        '',
        '  // the chain runs to the end; the first field that separates the rows decides',
        '  function compare(a, b) {',
        '    for (let i = 0; i < plan.length; i += 1) {',
        '      const order = compareValues(a[plan[i].field], b[plan[i].field]);',
        '      if (order !== 0) return order * plan[i].sign;',
        '    }',
        '    return 0;',
        '  }',
        '',
        '  return rows.slice().sort(compare);',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'numbers sort numerically, not as strings',
          assert: function (orderBy, api) {
            const rows = [1, 2, 10, 200, 3, 40].map(function (value) { return { id: value, score: value }; });
            const ascending = orderBy(rows, ['score']).map(function (row) { return row.score; });
            api.assert.deepEqual(ascending, [1, 2, 3, 10, 40, 200], 'ascending by score');

            const descending = orderBy(rows, ['-score']).map(function (row) { return row.score; });
            api.assert.deepEqual(descending, [200, 40, 10, 3, 2, 1], 'descending by score');
            api.assert.equal(rows[0].score, 1, 'the input must not be reordered in place');
          }
        },
        {
          name: 'the tie-break chain is followed to the end',
          assert: function (orderBy, api) {
            const rows = [
              { id: 4, score: 10, name: 'ada' },
              { id: 1, score: 10, name: 'bob' },
              { id: 3, score: 20, name: 'ada' },
              { id: 2, score: 10, name: 'ada' }
            ];

            const ordered = orderBy(rows, ['-score', 'name', 'id']);
            api.assert.deepEqual(ordered.map(function (row) { return row.id; }), [3, 2, 4, 1],
              'score descending, then name ascending, then id ascending');
          }
        },
        {
          name: 'the order is total: two shuffles sort identically',
          assert: function (orderBy, api) {
            const random = api.rng;
            const rows = [];
            for (let i = 0; i < 600; i += 1) {
              rows.push({ id: i, score: random.int(5), name: 'name-' + random.int(4) });
            }

            const fields = ['-score', 'name', 'id'];
            const reference = orderBy(rows, fields).map(function (row) { return row.id; });

            for (let trial = 0; trial < 3; trial += 1) {
              const shuffled = random.shuffle(rows.slice());
              const again = orderBy(shuffled, fields).map(function (row) { return row.id; });
              api.assert.deepEqual(again, reference, 'shuffle ' + trial + ' sorted to a different order');
            }
          }
        },
        {
          name: 'pages taken from one sort agree with pages taken from another',
          assert: function (orderBy, api) {
            const random = api.rng;
            const rows = [];
            for (let i = 0; i < 300; i += 1) rows.push({ id: i, score: random.int(3) });

            const fields = ['-score', 'id'];
            const firstPage = orderBy(rows, fields).slice(0, 25).map(function (row) { return row.id; });
            const secondPage = orderBy(random.shuffle(rows.slice()), fields)
              .slice(25, 50).map(function (row) { return row.id; });

            const seen = {};
            firstPage.concat(secondPage).forEach(function (id) {
              api.assert.ok(!seen[id], 'row ' + id + ' appears on both pages');
              seen[id] = true;
            });
            api.assert.equal(firstPage.length + secondPage.length, 50, 'two full pages');
          }
        }
      ]
    }]
  });
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null)));

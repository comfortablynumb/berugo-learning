/**
 * Graded exercises for prefetching, DRAM, NUMA and measurement
 * (M37.7-M37.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    prefetching: [{
      id: 'stride-with-confidence',
      title: 'Build a stride prefetcher that refuses to guess',
      prompt: 'Write lab() returning { predict, score }. predict(accesses, confidence) takes '
        + 'an array of { pc, line } in order and returns the array of lines the prefetcher '
        + 'issues. Keep one entry per pc holding its last line, its last delta and a run '
        + 'counter: on each access compute the delta from that pc\'s last line, increment the '
        + 'counter when it equals the stored delta and reset it to 1 otherwise, and issue '
        + 'line + delta only once the counter has reached confidence. A delta of 0 is never '
        + 'worth acting on. score(issued, demandMisses, baselineMisses) returns '
        + '{ coverage, accuracy, traffic }: coverage is the misses removed over the baseline, '
        + 'accuracy is the used prefetches over the issued ones - a prefetch counts as used '
        + 'when it removed a miss - and traffic is demandMisses plus issued. The starter '
        + 'issues on every access and reports coverage alone.',
      entry: 'lab',
      starter: [
        'function predict(accesses, confidence) {',
        '  var table = {};',
        '  var out = [];',
        '',
        '  accesses.forEach(function (access) {',
        '    var last = table[access.pc];',
        '',
        '    // Wrong: any delta is acted on at once, so noise becomes prefetches.',
        '    if (last !== undefined) out.push(access.line + (access.line - last));',
        '    table[access.pc] = access.line;',
        '  });',
        '  return out;',
        '}',
        '',
        'function score(issued, demandMisses, baselineMisses) {',
        '  return { coverage: (baselineMisses - demandMisses) / baselineMisses };',
        '}',
        '',
        'function lab() {',
        '  return { predict: predict, score: score };',
        '}'
      ].join('\n'),
      solution: [
        '/* The confidence counter is the whole difference between this and a',
        '   random-address generator: every pair of accesses defines a delta, and',
        '   in a random pattern every one of them is noise. Only a delta that has',
        '   repeated is evidence. */',
        'function predict(accesses, confidence) {',
        '  var table = {};',
        '  var out = [];',
        '',
        '  accesses.forEach(function (access) {',
        '    var entry = table[access.pc];',
        '    var delta;',
        '',
        '    if (!entry) {',
        '      table[access.pc] = { line: access.line, delta: 0, runs: 0 };',
        '      return;',
        '    }',
        '    delta = access.line - entry.line;',
        '    if (delta !== 0 && delta === entry.delta) entry.runs += 1;',
        '    else entry.runs = 1;',
        '    entry.delta = delta;',
        '    entry.line = access.line;',
        '    if (delta !== 0 && entry.runs >= confidence) out.push(access.line + delta);',
        '  });',
        '  return out;',
        '}',
        '',
        '/* Coverage on its own ranks the designs wrongly: a prefetcher can buy it',
        '   by guessing constantly, and the bill arrives as traffic. */',
        'function score(issued, demandMisses, baselineMisses) {',
        '  var used = baselineMisses - demandMisses;',
        '',
        '  return {',
        '    coverage: baselineMisses ? used / baselineMisses : 0,',
        '    accuracy: issued ? used / issued : 0,',
        '    traffic: demandMisses + issued',
        '  };',
        '}',
        '',
        'function lab() {',
        '  return { predict: predict, score: score };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a repeating stride is prefetched once the counter is satisfied',
          assert: function (lab, api) {
            const accesses = [0, 3, 6, 9, 12].map(function (line) {
              return { pc: 1, line: line };
            });
            const got = lab().predict(accesses, 2);

            api.assert.deepEqual(got, [9, 12, 15],
              'the first access has no delta and the second has not repeated one yet');
          }
        },
        {
          name: 'a pattern with no repeating delta produces nothing at all',
          assert: function (lab, api) {
            const accesses = [0, 17, 4, 91, 33, 12].map(function (line) {
              return { pc: 1, line: line };
            });

            api.assert.equal(lab().predict(accesses, 2).length, 0,
              'doing nothing is the correct behaviour on a random pattern');
          }
        },
        {
          name: 'two access sites keep separate strides',
          assert: function (lab, api) {
            const accesses = [
              { pc: 1, line: 0 }, { pc: 2, line: 100 },
              { pc: 1, line: 2 }, { pc: 2, line: 110 },
              { pc: 1, line: 4 }, { pc: 2, line: 120 }
            ];
            const got = lab().predict(accesses, 2);

            api.assert.deepEqual(got, [6, 130],
              'a table indexed by address would have seen one incoherent stream');
          }
        },
        {
          name: 'accuracy is what separates a useful prefetcher from an expensive one',
          assert: function (lab, api) {
            const parts = lab();
            const stride = parts.score(506, 8, 512);
            const stream = parts.score(1532, 4, 512);

            api.assert.ok(Math.abs(stride.accuracy - 0.996) < 0.01, 'almost every guess was used');
            api.assert.ok(stream.coverage > stride.coverage, 'the stream design covers more');
            api.assert.ok(stream.traffic > stride.traffic * 2,
              'and pays for it with more than double the traffic');
          }
        }
      ]
    }],

    'dram-and-the-memory-controller': [{
      id: 'row-buffer-and-frfcfs',
      title: 'Cost an access from the row buffer, and pick the next request',
      prompt: 'Write lab() returning { cost, choose }. cost(open, row, timing) returns the '
        + 'cycles a request costs given the row currently open in its bank (null when none '
        + 'is), the row it wants, and timing { tCAS, tRCD, tRP }: a hit is tCAS, a miss with '
        + 'nothing open is tRCD + tCAS, and a conflict with another row open is '
        + 'tRP + tRCD + tCAS. choose(queue, banks, policy) picks the next request from an '
        + 'array of { bank, row, arrived }, where banks is an array whose entry per bank is '
        + 'the open row or null: under "fcfs" take the oldest arrival; under "frfcfs" take the '
        + 'oldest request that hits its bank\'s open row, falling back to the oldest overall. '
        + 'Return the request object itself. The starter charges every access the same and '
        + 'always takes the head of the queue.',
      entry: 'lab',
      starter: [
        'function cost(open, row, timing) {',
        '  // Wrong: the data-sheet number for every access, whatever is open.',
        '  return timing.tCAS;',
        '}',
        '',
        'function choose(queue, banks, policy) {',
        '  return queue[0];',
        '}',
        '',
        'function lab() {',
        '  return { cost: cost, choose: choose };',
        '}'
      ].join('\n'),
      solution: [
        '/* Three outcomes and a factor of three between the ends. The published',
        '   latency is the first branch and a loaded machine lives in the third. */',
        'function cost(open, row, timing) {',
        '  if (open === row) return timing.tCAS;',
        '  if (open === null || open === undefined) return timing.tRCD + timing.tCAS;',
        '  return timing.tRP + timing.tRCD + timing.tCAS;',
        '}',
        '',
        '/* The queue is in arrival order, so "oldest" is just the first match.',
        '   Falling back to the head is what stops the policy stalling when nothing',
        '   is ready, and the queue depth is what bounds how far a request can be',
        '   passed over. */',
        'function choose(queue, banks, policy) {',
        '  var ready;',
        '',
        '  if (!queue.length) return null;',
        '  if (policy !== "frfcfs") return queue[0];',
        '  ready = queue.filter(function (request) {',
        '    return banks[request.bank] === request.row;',
        '  });',
        '  return ready.length ? ready[0] : queue[0];',
        '}',
        '',
        'function lab() {',
        '  return { cost: cost, choose: choose };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the three outcomes span a factor of three',
          assert: function (lab, api) {
            const timing = { tCAS: 15, tRCD: 15, tRP: 15 };
            const parts = lab();

            api.assert.equal(parts.cost(7, 7, timing), 15, 'the row is already open');
            api.assert.equal(parts.cost(null, 7, timing), 30, 'activate, then read');
            api.assert.equal(parts.cost(3, 7, timing), 45, 'close, activate, then read');
          }
        },
        {
          name: 'FR-FCFS serves a request that hits the open row before an older one',
          assert: function (lab, api) {
            const queue = [
              { bank: 0, row: 5, arrived: 1 },
              { bank: 1, row: 9, arrived: 2 },
              { bank: 0, row: 2, arrived: 3 }
            ];
            const banks = [2, 4];
            const parts = lab();

            api.assert.equal(parts.choose(queue, banks, 'fcfs').arrived, 1, 'arrival order');
            api.assert.equal(parts.choose(queue, banks, 'frfcfs').arrived, 3,
              'bank 0 has row 2 open, so the youngest request is the ready one');
          }
        },
        {
          name: 'with nothing ready FR-FCFS falls back to the oldest, and never stalls',
          assert: function (lab, api) {
            const queue = [{ bank: 0, row: 5, arrived: 1 }, { bank: 1, row: 9, arrived: 2 }];
            const parts = lab();

            api.assert.equal(parts.choose(queue, [null, null], 'frfcfs').arrived, 1,
              'no open row matches, so the oldest goes');
            api.assert.equal(parts.choose([], [null, null], 'frfcfs'), null, 'an empty queue');
          }
        }
      ]
    }],

    'numa-and-affinity': [{
      id: 'first-touch-and-migration',
      title: 'Place pages by first touch, then decide when a page should move',
      prompt: 'Write lab() returning { place, locality, shouldMigrate }. place(accesses) takes '
        + 'an array of { page, node, write } in order and returns a map from page to the node '
        + 'that first WROTE it - a read of an unplaced page does not place it. '
        + 'locality(accesses, homes) returns the fraction of accesses whose node equals the '
        + 'page\'s home, counting an access to an unplaced page as remote. '
        + 'shouldMigrate(history, threshold) takes an array of node numbers that accessed one '
        + 'page in order, and returns true only when the LAST threshold accesses all came from '
        + 'the same node - a run broken by any other node has to start again, which is what '
        + 'stops a shared page shuttling forever. The starter places on any access and '
        + 'migrates on a simple majority.',
      entry: 'lab',
      starter: [
        'function place(accesses) {',
        '  var homes = {};',
        '',
        '  accesses.forEach(function (access) {',
        '    // Wrong: a read places the page too, so a reader steals it.',
        '    if (homes[access.page] === undefined) homes[access.page] = access.node;',
        '  });',
        '  return homes;',
        '}',
        '',
        'function locality(accesses, homes) {',
        '  var local = 0;',
        '',
        '  accesses.forEach(function (access) {',
        '    if (homes[access.page] === access.node) local += 1;',
        '  });',
        '  return accesses.length ? local / accesses.length : 0;',
        '}',
        '',
        'function shouldMigrate(history, threshold) {',
        '  // Wrong: a majority, so an alternating pattern migrates forever.',
        '  var counts = {};',
        '  var best = 0;',
        '',
        '  history.forEach(function (node) {',
        '    counts[node] = (counts[node] || 0) + 1;',
        '    if (counts[node] > best) best = counts[node];',
        '  });',
        '  return best * 2 > history.length;',
        '}',
        '',
        'function lab() {',
        '  return { place: place, locality: locality, shouldMigrate: shouldMigrate };',
        '}'
      ].join('\n'),
      solution: [
        '/* First touch means the first WRITE. That is exactly right when the writer',
        '   is the eventual user, and exactly wrong for the initialisation loop at',
        '   the top of a parallel program. */',
        'function place(accesses) {',
        '  var homes = {};',
        '',
        '  accesses.forEach(function (access) {',
        '    if (access.write && homes[access.page] === undefined) {',
        '      homes[access.page] = access.node;',
        '    }',
        '  });',
        '  return homes;',
        '}',
        '',
        'function locality(accesses, homes) {',
        '  var local = 0;',
        '',
        '  accesses.forEach(function (access) {',
        '    var home = homes[access.page];',
        '',
        '    if (home !== undefined && home === access.node) local += 1;',
        '  });',
        '  return accesses.length ? local / accesses.length : 0;',
        '}',
        '',
        '/* The reset is the hard half. Moving a page towards a stable user is easy;',
        '   refusing to move one that two nodes are sharing is what separates an',
        '   adaptive policy from a thrashing one. */',
        'function shouldMigrate(history, threshold) {',
        '  var at;',
        '',
        '  if (history.length < threshold || threshold < 1) return false;',
        '  for (at = history.length - threshold; at < history.length; at += 1) {',
        '    if (history[at] !== history[history.length - 1]) return false;',
        '  }',
        '  return true;',
        '}',
        '',
        'function lab() {',
        '  return { place: place, locality: locality, shouldMigrate: shouldMigrate };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'one thread initialising everything puts every page on its node',
          assert: function (lab, api) {
            const accesses = [];
            const parts = lab();

            for (let page = 0; page < 4; page += 1) {
              accesses.push({ page: page, node: 0, write: true });
            }
            for (let page = 0; page < 4; page += 1) {
              accesses.push({ page: page, node: page < 2 ? 0 : 1, write: false });
            }
            const homes = parts.place(accesses);

            api.assert.deepEqual(homes, { 0: 0, 1: 0, 2: 0, 3: 0 }, 'all four on node 0');
            api.assert.equal(parts.locality(accesses.slice(4), homes), 0.5,
              'the workers on node 1 are all remote');
          }
        },
        {
          name: 'a read never places a page',
          assert: function (lab, api) {
            const homes = lab().place([
              { page: 7, node: 1, write: false },
              { page: 7, node: 0, write: true }
            ]);

            api.assert.deepEqual(homes, { 7: 0 }, 'the writer placed it, not the reader');
          }
        },
        {
          name: 'a run of remote accesses migrates and an alternating pattern does not',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.ok(parts.shouldMigrate([0, 1, 1, 1, 1], 4), 'node 1 is the stable user');
            api.assert.ok(!parts.shouldMigrate([0, 1, 0, 1, 0, 1], 4),
              'the run resets on every access from the other node');
            api.assert.ok(!parts.shouldMigrate([1, 1], 4), 'not enough history yet');
          }
        }
      ]
    }],

    'measuring-the-hierarchy': [{
      id: 'discover-the-machine',
      title: 'Read capacities, associativity and line size out of measurements',
      prompt: 'Write lab() returning { capacities, associativity, lineSize }. '
        + 'capacities(curve, threshold) takes { bytes, cycles } points ordered by increasing '
        + 'size and returns the bytes BELOW each point where the cost rose by at least '
        + 'threshold times. associativity(trials) takes { lines, allHit } rows ordered by '
        + 'increasing lines and returns the largest lines value that still hit, or 0 if none '
        + 'did. lineSize(sweep) takes { stride, misses } rows ordered by increasing stride, '
        + 'measured on a working set far too large to fit, and returns the LARGEST stride '
        + 'whose miss count still equals the first row\'s - while the stride is inside a line '
        + 'every line is fetched exactly once however fine the stride is, and once the stride '
        + 'passes the line size fewer lines are touched and the count falls. The starter reads '
        + 'the size above each step, returns the first failing trial, and takes the smallest '
        + 'stride.',
      entry: 'lab',
      starter: [
        'function capacities(curve, threshold) {',
        '  var found = [];',
        '',
        '  for (var at = 1; at < curve.length; at += 1) {',
        '    // Off by one: this reports every cache as twice its real size.',
        '    if (curve[at].cycles >= curve[at - 1].cycles * threshold) found.push(curve[at].bytes);',
        '  }',
        '  return found;',
        '}',
        '',
        'function associativity(trials) {',
        '  for (var at = 0; at < trials.length; at += 1) {',
        '    if (!trials[at].allHit) return trials[at].lines; // the FAILING count',
        '  }',
        '  return 0;',
        '}',
        '',
        'function lineSize(sweep) {',
        '  return sweep[0].stride;',
        '}',
        '',
        'function lab() {',
        '  return { capacities: capacities, associativity: associativity, lineSize: lineSize };',
        '}'
      ].join('\n'),
      solution: [
        '/* Every answer here is an off-by-one waiting to happen, and each one has a',
        '   direction: the capacity is BELOW the step, the associativity is the last',
        '   count that still hit, and the line size is where the misses STOP rising. */',
        'function capacities(curve, threshold) {',
        '  var found = [];',
        '  var at;',
        '',
        '  for (at = 1; at < curve.length; at += 1) {',
        '    if (curve[at].cycles >= curve[at - 1].cycles * threshold) {',
        '      found.push(curve[at - 1].bytes);',
        '    }',
        '  }',
        '  return found;',
        '}',
        '',
        'function associativity(trials) {',
        '  var best = 0;',
        '',
        '  trials.forEach(function (trial) {',
        '    if (trial.allHit && trial.lines > best) best = trial.lines;',
        '  });',
        '  return best;',
        '}',
        '',
        'function lineSize(sweep) {',
        '  var flat = sweep[0].misses;',
        '  var best = sweep[0].stride;',
        '',
        '  sweep.forEach(function (row) {',
        '    if (row.misses === flat && row.stride > best) best = row.stride;',
        '  });',
        '  return best;',
        '}',
        '',
        'function lab() {',
        '  return { capacities: capacities, associativity: associativity, lineSize: lineSize };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'three steps recover three capacities, each from the size below',
          assert: function (lab, api) {
            const curve = [
              { bytes: 16384, cycles: 4 }, { bytes: 32768, cycles: 4 },
              { bytes: 65536, cycles: 18 }, { bytes: 524288, cycles: 18 },
              { bytes: 1048576, cycles: 63 }, { bytes: 8388608, cycles: 63 },
              { bytes: 16777216, cycles: 313 }
            ];

            api.assert.deepEqual(lab().capacities(curve, 1.35), [32768, 524288, 8388608],
              'the configured capacities, recovered exactly');
          }
        },
        {
          name: 'the associativity is the largest conflict set that still hit',
          assert: function (lab, api) {
            const trials = [1, 2, 4, 8, 9, 10].map(function (lines) {
              return { lines: lines, allHit: lines <= 8 };
            });

            api.assert.equal(lab().associativity(trials), 8, 'not the count that failed');
            api.assert.equal(lab().associativity([{ lines: 1, allHit: false }]), 0,
              'nothing fitted at all');
          }
        },
        {
          name: 'the line size is where the miss count stops rising, not where it starts',
          assert: function (lab, api) {
            const sweep = [
              { stride: 8, misses: 4096 }, { stride: 16, misses: 4096 },
              { stride: 32, misses: 4096 }, { stride: 64, misses: 4096 },
              { stride: 128, misses: 2048 }, { stride: 256, misses: 1024 }
            ];

            api.assert.equal(lab().lineSize(sweep), 64, 'the configured line size');
            api.assert.equal(lab().lineSize([{ stride: 8, misses: 900 },
              { stride: 16, misses: 900 }, { stride: 32, misses: 450 }]), 16,
              'a 16-byte line, on the same reasoning');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

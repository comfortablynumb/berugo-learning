/**
 * Graded exercises for shapes, runtime metadata and measurement (M30.8-M30.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'inline-caches': [{
      id: 'inline-cache',
      title: 'Build the transition tree and the cache that gives up',
      prompt: 'Write makeTree() returning { root, shapes } where a shape is { id, fields, ' +
        'transitions }. Write build(tree, names) which walks the transitions, creating one ' +
        'where none exists, and returns the final shape — so two objects built the same way ' +
        'share a shape and two built in different orders do not. Write makeCache() and ' +
        'lookup(cache, shape, name) returning { offset, hit, state }. A hit is a shape already ' +
        'in the cache; a miss adds it. `state` is "monomorphic" with one entry, "polymorphic" ' +
        'with two to four, and "megamorphic" once a fifth would be added — at which point the ' +
        'entries are discarded and every later access is a miss. The starter never gives up, ' +
        'so a site that has seen fifty shapes still walks a fifty-entry list.',
      entry: 'lab',
      starter: [
        'const LIMIT = 4;',
        '',
        'function makeTree() {',
        '  const root = { id: 0, fields: [], transitions: {} };',
        '',
        '  return { root: root, shapes: [root] };',
        '}',
        '',
        'function build(tree, names) {',
        '  let shape = tree.root;',
        '',
        '  names.forEach(function (name) {',
        '    if (!shape.transitions[name]) {',
        '      const next = { id: tree.shapes.length, fields: shape.fields.concat([name]),',
        '        transitions: {} };',
        '',
        '      tree.shapes.push(next);',
        '      shape.transitions[name] = next;',
        '    }',
        '    shape = shape.transitions[name];',
        '  });',
        '  return shape;',
        '}',
        '',
        'function makeCache() {',
        '  return { entries: [], hits: 0, misses: 0, state: "uninitialised" };',
        '}',
        '',
        'function lookup(cache, shape, name) {',
        '  for (let at = 0; at < cache.entries.length; at += 1) {',
        '    if (cache.entries[at].shape !== shape.id) continue;',
        '    cache.hits += 1;',
        '    return { offset: cache.entries[at].offset, hit: true, state: cache.state };',
        '  }',
        '  cache.misses += 1;',
        '  // The list grows without limit, so a hot site with many shapes ends up',
        '  // walking a longer list than the lookup it replaced.',
        '  cache.entries.push({ shape: shape.id, offset: shape.fields.indexOf(name) });',
        '  cache.state = cache.entries.length === 1 ? "monomorphic" : "polymorphic";',
        '  return { offset: shape.fields.indexOf(name), hit: false, state: cache.state };',
        '}',
        '',
        'function lab() {',
        '  return { makeTree: makeTree, build: build, makeCache: makeCache, lookup: lookup,',
        '    LIMIT: LIMIT };',
        '}'
      ].join('\n'),
      solution: [
        'const LIMIT = 4;',
        '',
        'function makeTree() {',
        '  const root = { id: 0, fields: [], transitions: {} };',
        '',
        '  return { root: root, shapes: [root] };',
        '}',
        '',
        'function build(tree, names) {',
        '  let shape = tree.root;',
        '',
        '  names.forEach(function (name) {',
        '    if (!shape.transitions[name]) {',
        '      const next = { id: tree.shapes.length, fields: shape.fields.concat([name]),',
        '        transitions: {} };',
        '',
        '      tree.shapes.push(next);',
        '      shape.transitions[name] = next;',
        '    }',
        '    shape = shape.transitions[name];',
        '  });',
        '  return shape;',
        '}',
        '',
        'function makeCache() {',
        '  return { entries: [], hits: 0, misses: 0, state: "uninitialised",',
        '    megamorphic: false };',
        '}',
        '',
        'function hitAt(cache, at) {',
        '  cache.hits += 1;',
        '  return { offset: cache.entries[at].offset, hit: true, state: cache.state };',
        '}',
        '',
        'function miss(cache, shape, name) {',
        '  const offset = shape.fields.indexOf(name);',
        '',
        '  cache.misses += 1;',
        '  if (cache.megamorphic) return { offset: offset, hit: false, state: "megamorphic" };',
        '  cache.entries.push({ shape: shape.id, offset: offset });',
        '  cache.state = cache.entries.length === 1 ? "monomorphic" : "polymorphic";',
        '  if (cache.entries.length > LIMIT) {',
        '    cache.megamorphic = true;',
        '    cache.state = "megamorphic";',
        '    cache.entries = [];',
        '  }',
        '  return { offset: offset, hit: false, state: cache.state };',
        '}',
        '',
        'function lookup(cache, shape, name) {',
        '  if (cache.megamorphic) return miss(cache, shape, name);',
        '  for (let at = 0; at < cache.entries.length; at += 1) {',
        '    if (cache.entries[at].shape === shape.id) return hitAt(cache, at);',
        '  }',
        '  return miss(cache, shape, name);',
        '}',
        '',
        'function lab() {',
        '  return { makeTree: makeTree, build: build, makeCache: makeCache, lookup: lookup,',
        '    LIMIT: LIMIT };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'two orders of the same fields are two shapes',
          assert: function (lab, api) {
            const parts = lab();
            const tree = parts.makeTree();
            const one = parts.build(tree, ['x', 'y']);
            const two = parts.build(tree, ['y', 'x']);
            const three = parts.build(tree, ['x', 'y']);

            api.assert.equal(one.id, three.id, 'the same order shares a shape');
            api.assert.ok(one.id !== two.id, 'the other order does not');
            api.assert.equal(one.fields.indexOf('x'), 0);
            api.assert.equal(two.fields.indexOf('x'), 1, 'and the offsets genuinely differ');
          }
        },
        {
          name: 'the cache gives up past the polymorphic limit',
          assert: function (lab, api) {
            const parts = lab();
            const tree = parts.makeTree();
            const cache = parts.makeCache();
            const shapes = [];

            for (let at = 0; at <= parts.LIMIT; at += 1) {
              shapes.push(parts.build(tree, ['x'].concat(['f' + at])));
            }
            shapes.forEach(function (shape) { parts.lookup(cache, shape, 'x'); });
            api.assert.equal(cache.state, 'megamorphic',
              parts.LIMIT + ' entries plus one more should give up, state is ' + cache.state);

            const before = cache.hits;

            shapes.forEach(function (shape) { parts.lookup(cache, shape, 'x'); });
            api.assert.equal(cache.hits, before,
              'a megamorphic cache caches nothing, so nothing hits');
          }
        },
        {
          name: 'one shape is monomorphic and every later access hits',
          assert: function (lab, api) {
            const parts = lab();
            const tree = parts.makeTree();
            const cache = parts.makeCache();
            const shape = parts.build(tree, ['x', 'y']);

            for (let at = 0; at < 10; at += 1) parts.lookup(cache, shape, 'y');
            api.assert.equal(cache.state, 'monomorphic');
            api.assert.equal(cache.hits, 9, 'nine hits after the first miss');
            api.assert.equal(parts.lookup(cache, shape, 'y').offset, 1,
              'and the offset is the one the shape fixed');
          }
        }
      ]
    }],

    'runtime-support': [{
      id: 'stack-maps',
      title: 'Build the stack map from liveness, not from what the frame holds',
      prompt: 'Code is a list of instructions, each { op, dest, reads, target } where a "jump" ' +
        'has a target, a "branch" has a target and falls through, and a "ret" has neither. ' +
        'Write successors(code, pc) returning the indices control can reach next. Write ' +
        'liveness(code) returning, for each instruction, the set of registers read at or after ' +
        'it before being written — as a sorted list. Write stackMap(code, safepoints) ' +
        'returning one row per index in `safepoints`, as { pc, live }, using that liveness. ' +
        'The starter reports every register DEFINED so far instead, which lists values nothing ' +
        'will read again — the difference between a precise collector and one that keeps dead ' +
        'objects alive.',
      entry: 'lab',
      starter: [
        'function successors(code, pc) {',
        '  const inst = code[pc];',
        '',
        '  if (inst.op === "ret") return [];',
        '  if (inst.op === "jump") return [inst.target];',
        '  if (inst.op === "branch") {',
        '    return [inst.target, pc + 1].filter(function (at) { return at < code.length; });',
        '  }',
        '  return pc + 1 < code.length ? [pc + 1] : [];',
        '}',
        '',
        'function liveness(code) {',
        '  const live = code.map(function () { return []; });',
        '  let changed = true;',
        '  let rounds = 0;',
        '',
        '  while (changed && rounds < 20) {',
        '    changed = false;',
        '    rounds += 1;',
        '    for (let pc = code.length - 1; pc >= 0; pc -= 1) {',
        '      const after = {};',
        '',
        '      successors(code, pc).forEach(function (next) {',
        '        live[next].forEach(function (name) { after[name] = true; });',
        '      });',
        '      if (code[pc].dest) delete after[code[pc].dest];',
        '      (code[pc].reads || []).forEach(function (name) { after[name] = true; });',
        '      const rows = Object.keys(after).sort();',
        '',
        '      if (rows.join(",") === live[pc].join(",")) continue;',
        '      live[pc] = rows;',
        '      changed = true;',
        '    }',
        '  }',
        '  return live;',
        '}',
        '',
        'function stackMap(code, safepoints) {',
        '  const defined = [];',
        '',
        '  // Everything defined so far, which includes values nothing will read',
        '  // again — the collector would keep them and everything they point at.',
        '  return code.map(function (inst, pc) {',
        '    if (inst.dest && defined.indexOf(inst.dest) === -1) defined.push(inst.dest);',
        '    return { pc: pc, live: defined.slice().sort() };',
        '  }).filter(function (row) { return safepoints.indexOf(row.pc) !== -1; });',
        '}',
        '',
        'function lab() {',
        '  return { successors: successors, liveness: liveness, stackMap: stackMap };',
        '}'
      ].join('\n'),
      solution: [
        'function successors(code, pc) {',
        '  const inst = code[pc];',
        '',
        '  if (inst.op === "ret") return [];',
        '  if (inst.op === "jump") return [inst.target];',
        '  if (inst.op === "branch") {',
        '    return [inst.target, pc + 1].filter(function (at) { return at < code.length; });',
        '  }',
        '  return pc + 1 < code.length ? [pc + 1] : [];',
        '}',
        '',
        'function liveAt(code, live, pc) {',
        '  const after = {};',
        '',
        '  successors(code, pc).forEach(function (next) {',
        '    live[next].forEach(function (name) { after[name] = true; });',
        '  });',
        '  if (code[pc].dest) delete after[code[pc].dest];',
        '  (code[pc].reads || []).forEach(function (name) { after[name] = true; });',
        '  return Object.keys(after).sort();',
        '}',
        '',
        'function liveness(code) {',
        '  const live = code.map(function () { return []; });',
        '  let changed = true;',
        '  let rounds = 0;',
        '',
        '  while (changed && rounds < 20) {',
        '    changed = false;',
        '    rounds += 1;',
        '    for (let pc = code.length - 1; pc >= 0; pc -= 1) {',
        '      const rows = liveAt(code, live, pc);',
        '',
        '      if (rows.join(",") === live[pc].join(",")) continue;',
        '      live[pc] = rows;',
        '      changed = true;',
        '    }',
        '  }',
        '  return live;',
        '}',
        '',
        'function stackMap(code, safepoints) {',
        '  const live = liveness(code);',
        '',
        '  return safepoints.slice().sort(function (a, b) { return a - b; })',
        '    .map(function (pc) {',
        '      const after = {};',
        '',
        '      successors(code, pc).forEach(function (next) {',
        '        live[next].forEach(function (name) { after[name] = true; });',
        '      });',
        '      return { pc: pc, live: Object.keys(after).sort() };',
        '    });',
        '}',
        '',
        'function lab() {',
        '  return { successors: successors, liveness: liveness, stackMap: stackMap };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a value nothing reads again is deliberately absent from the map',
          assert: function (lab, api) {
            const parts = lab();
            const code = [
              { op: 'alloc', dest: 'dead' },
              { op: 'alloc', dest: 'live' },
              { op: 'call', dest: 'r' },
              { op: 'use', reads: ['live'] },
              { op: 'ret' }
            ];
            const rows = parts.stackMap(code, [2]);

            api.assert.equal(rows.length, 1, 'one safepoint');
            api.assert.ok(rows[0].live.indexOf('live') !== -1,
              'the value read after the call is a root');
            api.assert.equal(rows[0].live.indexOf('dead'), -1,
              'the value nothing reads again is not, and scanning it would retain it');
          }
        },
        {
          name: 'a loop keeps a value live before its own definition',
          assert: function (lab, api) {
            const parts = lab();
            const code = [
              { op: 'const', dest: 'i' },
              { op: 'call', dest: 'x', reads: ['i'] },
              { op: 'add', dest: 'i', reads: ['i', 'x'] },
              { op: 'branch', target: 1, reads: ['i'] },
              { op: 'ret', reads: ['i'] }
            ];
            const live = parts.liveness(code);

            api.assert.ok(live[1].indexOf('i') !== -1,
              'i is live at the call because the back edge brings it round');
            const rows = parts.stackMap(code, [1]);

            api.assert.ok(rows[0].live.indexOf('i') !== -1,
              'so the safepoint at the call has to list it');
          }
        },
        {
          name: 'a branch makes a value live if either arm reads it',
          assert: function (lab, api) {
            const parts = lab();
            const code = [
              { op: 'alloc', dest: 'a' },
              { op: 'call', dest: 'c' },
              { op: 'branch', target: 4, reads: ['c'] },
              { op: 'use', reads: ['a'] },
              { op: 'ret' }
            ];
            const rows = parts.stackMap(code, [1]);

            api.assert.ok(rows[0].live.indexOf('a') !== -1,
              'one arm reads it, so it is live on some path from here');
            api.assert.ok(rows[0].live.indexOf('c') !== -1,
              'and the branch condition is read immediately after');
          }
        }
      ]
    }],

    'measuring-a-runtime': [{
      id: 'bench-protocol',
      title: 'Write a benchmark harness that cannot lie by omission',
      prompt: 'Write bench(work, options) where `work` is a function returning a value and ' +
        '`options` is { warmup, runs, clock } with `clock` a function returning a number. Run ' +
        '`work` `warmup` times and DISCARD those timings, then `runs` times keeping each. ' +
        'Return { median, best, worst, spread, runs, warmup, checksum } where `checksum` is ' +
        'derived from the last result so nothing can be deleted for being unobserved, and ' +
        '`median` is the middle of the sorted sample. Write scales(sizes, run) returning one ' +
        'row per size as { size, cost, perItem } using run(size), and flat(rows) returning ' +
        'true when the per-item cost varies by less than a tenth across the rows. The starter ' +
        'averages every run including the warm-up and reports no spread.',
      entry: 'lab',
      starter: [
        'function bench(work, options) {',
        '  const settings = options || {};',
        '  const warmup = settings.warmup === undefined ? 3 : settings.warmup;',
        '  const runs = settings.runs === undefined ? 5 : settings.runs;',
        '  const clock = settings.clock;',
        '  const samples = [];',
        '  let last = null;',
        '',
        '  // Warm-up is timed and averaged in, so a tiered runtime reports mostly',
        '  // its compiler.',
        '  for (let at = 0; at < warmup + runs; at += 1) {',
        '    const started = clock();',
        '',
        '    last = work();',
        '    samples.push(clock() - started);',
        '  }',
        '  const total = samples.reduce(function (sum, value) { return sum + value; }, 0);',
        '',
        '  return { median: total / samples.length, best: null, worst: null, spread: null,',
        '    runs: samples.length, warmup: 0, checksum: String(last).length };',
        '}',
        '',
        'function scales(sizes, run) {',
        '  return sizes.map(function (size) {',
        '    const cost = run(size);',
        '',
        '    return { size: size, cost: cost, perItem: cost / size };',
        '  });',
        '}',
        '',
        'function flat(rows) {',
        '  const first = rows[0].perItem;',
        '',
        '  return rows.every(function (row) {',
        '    return Math.abs(row.perItem - first) < first / 10;',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { bench: bench, scales: scales, flat: flat };',
        '}'
      ].join('\n'),
      solution: [
        'function bench(work, options) {',
        '  const settings = options || {};',
        '  const warmup = settings.warmup === undefined ? 3 : settings.warmup;',
        '  const runs = settings.runs === undefined ? 5 : settings.runs;',
        '  const clock = settings.clock;',
        '  const samples = [];',
        '  let last = null;',
        '',
        '  for (let at = 0; at < warmup; at += 1) last = work();',
        '  for (let at = 0; at < runs; at += 1) {',
        '    const started = clock();',
        '',
        '    last = work();',
        '    samples.push(clock() - started);',
        '  }',
        '  return summarise(samples, warmup, runs, last);',
        '}',
        '',
        'function summarise(samples, warmup, runs, last) {',
        '  const sorted = samples.slice().sort(function (a, b) { return a - b; });',
        '',
        '  return {',
        '    median: sorted[Math.floor(sorted.length / 2)],',
        '    best: sorted[0],',
        '    worst: sorted[sorted.length - 1],',
        '    spread: sorted[sorted.length - 1] - sorted[0],',
        '    runs: runs, warmup: warmup,',
        '    checksum: String(last).length',
        '  };',
        '}',
        '',
        'function scales(sizes, run) {',
        '  return sizes.map(function (size) {',
        '    const cost = run(size);',
        '',
        '    return { size: size, cost: cost, perItem: cost / size };',
        '  });',
        '}',
        '',
        'function flat(rows) {',
        '  const first = rows[0].perItem;',
        '',
        '  return rows.every(function (row) {',
        '    return Math.abs(row.perItem - first) < first / 10;',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { bench: bench, scales: scales, flat: flat };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'warm-up is discarded rather than averaged in',
          assert: function (lab, api) {
            const parts = lab();
            let tick = 0;
            let call = 0;
            /* The first three runs cost 100 each and the rest cost 10, which is
               what a tiered runtime looks like. */
            const clock = function () { return tick; };
            const work = function () {
              call += 1;
              tick += call <= 3 ? 100 : 10;
              return call;
            };
            const out = parts.bench(work, { warmup: 3, runs: 5, clock: clock });

            api.assert.equal(out.median, 10,
              'the warm-up runs are not in the sample, so the median is the steady state');
            api.assert.equal(out.runs, 5, 'and the run count is the sample, not the total');
            api.assert.equal(out.warmup, 3, 'with the warm-up reported beside it');
          }
        },
        {
          name: 'the spread is reported and the result is consumed',
          assert: function (lab, api) {
            const parts = lab();
            let tick = 0;
            let call = 0;
            const costs = [10, 40, 12, 11, 13];
            const clock = function () { return tick; };
            const work = function () {
              tick += costs[call % costs.length];
              call += 1;
              return 'result-' + call;
            };
            const out = parts.bench(work, { warmup: 0, runs: 5, clock: clock });

            api.assert.equal(out.best, 10);
            api.assert.equal(out.worst, 40);
            api.assert.equal(out.spread, 30, 'worst minus best');
            api.assert.ok(out.checksum > 0, 'the result is observed, so it cannot be deleted');
          }
        },
        {
          name: 'a benchmark whose cost is flat in its input is caught',
          assert: function (lab, api) {
            const parts = lab();
            const good = parts.scales([10, 20, 40], function (size) { return size * 16; });
            const bad = parts.scales([10, 20, 40], function () { return 500; });

            api.assert.ok(parts.flat(good), 'cost per item is constant, so the loop is the work');
            api.assert.ok(!parts.flat(bad),
              'a fixed cost means the benchmark is measuring its own setup');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

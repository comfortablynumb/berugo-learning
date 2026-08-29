/**
 * Graded exercises for dynamic analysis, fuzzing and specification (M32.9-M32.11).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'dynamic-analysis': [{
      id: 'vector-clock-races',
      title: 'Detect races with vector clocks',
      prompt: 'A trace is a list of { thread, op, target } where op is "read", "write", ' +
        '"acquire", "release", "fork" or "join". Write detect(trace) returning ' +
        '{ races, threads }: give every thread a vector clock, join the lock\'s clock on an ' +
        'acquire, store a copy of the thread\'s clock on the lock at a release and tick, copy '
        + 'clocks on fork and join, and report a race when two conflicting accesses to one '
        + 'location — at least one a write, from different threads — are not ordered by those '
        + 'clocks. The starter never stores anything on a release, so a lock orders nothing and '
        + 'every locked update is reported.',
      entry: 'lab',
      starter: [
        'function zero(threads) {',
        '  const clock = {};',
        '',
        '  threads.forEach(function (name) { clock[name] = 0; });',
        '  return clock;',
        '}',
        '',
        'function copy(clock) { return Object.assign({}, clock); }',
        '',
        'function joinInto(target, other) {',
        '  Object.keys(other).forEach(function (name) {',
        '    target[name] = Math.max(target[name] || 0, other[name]);',
        '  });',
        '  return target;',
        '}',
        '',
        'function precedes(earlier, later) {',
        '  return Object.keys(earlier).every(function (name) {',
        '    return earlier[name] <= (later[name] || 0);',
        '  });',
        '}',
        '',
        'function threadsOf(trace) {',
        '  const seen = {};',
        '',
        '  trace.forEach(function (event) {',
        '    seen[event.thread] = true;',
        '    if (event.op === "fork" || event.op === "join") seen[event.target] = true;',
        '  });',
        '  return Object.keys(seen).sort();',
        '}',
        '',
        'function step(state, event) {',
        '  const clock = state.clocks[event.thread];',
        '',
        '  if (event.op === "acquire") { joinInto(clock, state.locks[event.target] || {}); return; }',
        '  // Nothing is stored on the lock, so the next acquire learns nothing',
        '  // and no pair of locked accesses is ever ordered.',
        '  if (event.op === "release") { clock[event.thread] += 1; return; }',
        '  if (event.op === "fork") {',
        '    state.clocks[event.target] = joinInto(copy(clock), state.clocks[event.target] || {});',
        '    clock[event.thread] += 1;',
        '    return;',
        '  }',
        '  if (event.op === "join") { joinInto(clock, state.clocks[event.target] || {}); return; }',
        '  access(state, event, clock);',
        '}',
        '',
        'function access(state, event, clock) {',
        '  const key = event.target;',
        '  const seen = state.seen[key] || [];',
        '',
        '  seen.forEach(function (row) {',
        '    if (row.thread === event.thread) return;',
        '    if (row.op === "read" && event.op === "read") return;',
        '    if (precedes(row.clock, clock)) return;',
        '    state.races.push({ location: key, first: row.thread, second: event.thread });',
        '  });',
        '  seen.push({ thread: event.thread, op: event.op, clock: copy(clock) });',
        '  state.seen[key] = seen;',
        '}',
        '',
        'function detect(trace) {',
        '  const threads = threadsOf(trace);',
        '  const state = { clocks: {}, locks: {}, seen: {}, races: [] };',
        '',
        '  threads.forEach(function (name) {',
        '    state.clocks[name] = zero(threads);',
        '    state.clocks[name][name] = 1;',
        '  });',
        '  trace.forEach(function (event) { step(state, event); });',
        '  return { races: state.races, threads: threads };',
        '}',
        '',
        'function lab() {',
        '  return { detect: detect, precedes: precedes, joinInto: joinInto };',
        '}'
      ].join('\n'),
      solution: [
        'function zero(threads) {',
        '  const clock = {};',
        '',
        '  threads.forEach(function (name) { clock[name] = 0; });',
        '  return clock;',
        '}',
        '',
        'function copy(clock) { return Object.assign({}, clock); }',
        '',
        'function joinInto(target, other) {',
        '  Object.keys(other).forEach(function (name) {',
        '    target[name] = Math.max(target[name] || 0, other[name]);',
        '  });',
        '  return target;',
        '}',
        '',
        'function precedes(earlier, later) {',
        '  return Object.keys(earlier).every(function (name) {',
        '    return earlier[name] <= (later[name] || 0);',
        '  });',
        '}',
        '',
        'function threadsOf(trace) {',
        '  const seen = {};',
        '',
        '  trace.forEach(function (event) {',
        '    seen[event.thread] = true;',
        '    if (event.op === "fork" || event.op === "join") seen[event.target] = true;',
        '  });',
        '  return Object.keys(seen).sort();',
        '}',
        '',
        '/* The release is the half that carries the ordering: whatever this',
        '   thread did before it is now visible to whoever acquires the lock',
        '   next. Ticking the clock afterwards is what makes the next release',
        '   a later event than this one. */',
        'function step(state, event) {',
        '  const clock = state.clocks[event.thread];',
        '',
        '  if (event.op === "acquire") { joinInto(clock, state.locks[event.target] || {}); return; }',
        '  if (event.op === "release") {',
        '    state.locks[event.target] = copy(clock);',
        '    clock[event.thread] += 1;',
        '    return;',
        '  }',
        '  if (event.op === "fork") {',
        '    state.clocks[event.target] = joinInto(copy(clock), state.clocks[event.target] || {});',
        '    clock[event.thread] += 1;',
        '    return;',
        '  }',
        '  if (event.op === "join") { joinInto(clock, state.clocks[event.target] || {}); return; }',
        '  access(state, event, clock);',
        '}',
        '',
        'function access(state, event, clock) {',
        '  const key = event.target;',
        '  const seen = state.seen[key] || [];',
        '',
        '  seen.forEach(function (row) {',
        '    if (row.thread === event.thread) return;',
        '    if (row.op === "read" && event.op === "read") return;',
        '    if (precedes(row.clock, clock)) return;',
        '    state.races.push({ location: key, first: row.thread, second: event.thread });',
        '  });',
        '  seen.push({ thread: event.thread, op: event.op, clock: copy(clock) });',
        '  state.seen[key] = seen;',
        '}',
        '',
        'function detect(trace) {',
        '  const threads = threadsOf(trace);',
        '  const state = { clocks: {}, locks: {}, seen: {}, races: [] };',
        '',
        '  threads.forEach(function (name) {',
        '    state.clocks[name] = zero(threads);',
        '    state.clocks[name][name] = 1;',
        '  });',
        '  trace.forEach(function (event) { step(state, event); });',
        '  return { races: state.races, threads: threads };',
        '}',
        '',
        'function lab() {',
        '  return { detect: detect, precedes: precedes, joinInto: joinInto };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'two unsynchronised writes are a race',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.detect([
              { thread: 't1', op: 'write', target: 'balance' },
              { thread: 't2', op: 'write', target: 'balance' }
            ]);

            api.assert.equal(out.races.length, 1, 'nothing orders these two writes');
            api.assert.equal(out.races[0].location, 'balance', 'and the location is named');
          }
        },
        {
          name: 'the same lock orders both updates',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.detect([
              { thread: 't1', op: 'acquire', target: 'L' },
              { thread: 't1', op: 'write', target: 'balance' },
              { thread: 't1', op: 'release', target: 'L' },
              { thread: 't2', op: 'acquire', target: 'L' },
              { thread: 't2', op: 'write', target: 'balance' },
              { thread: 't2', op: 'release', target: 'L' }
            ]);

            api.assert.equal(out.races.length, 0,
              'the release stores the clock and the acquire picks it up');
          }
        },
        {
          name: 'a fork orders everything before it against the new thread',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.detect([
              { thread: 'main', op: 'write', target: 'config' },
              { thread: 'main', op: 'fork', target: 'worker' },
              { thread: 'worker', op: 'read', target: 'config' }
            ]);

            api.assert.equal(out.races.length, 0,
              'no schedule runs the write and the read together');
          }
        },
        {
          name: 'two reads never race, and different locks do not order',
          assert: function (lab, api) {
            const parts = lab();
            const reads = parts.detect([
              { thread: 't1', op: 'read', target: 'table' },
              { thread: 't2', op: 'read', target: 'table' }
            ]);
            const apart = parts.detect([
              { thread: 't1', op: 'acquire', target: 'L1' },
              { thread: 't1', op: 'write', target: 'balance' },
              { thread: 't1', op: 'release', target: 'L1' },
              { thread: 't2', op: 'acquire', target: 'L2' },
              { thread: 't2', op: 'write', target: 'balance' },
              { thread: 't2', op: 'release', target: 'L2' }
            ]);

            api.assert.equal(reads.races.length, 0, 'reads do not conflict');
            api.assert.equal(apart.races.length, 1, 'two different locks order nothing');
          }
        }
      ]
    }],

    'coverage-guided-fuzzing': [{
      id: 'corpus-minimisation',
      title: 'Minimise a corpus without losing an edge',
      prompt: 'A corpus is a list of { input, coverage } where coverage is a list of edge ' +
        'names. Write minimise(corpus) returning { corpus, before, after, coverage }: keep the '
        + 'SMALLEST inputs that between them cover every edge the original corpus covered, and '
        + 'drop the rest. Sort by input length first, keep an entry only when it contributes an '
        + 'edge nothing kept so far covers, and return the coverage of what you kept. The '
        + 'starter keeps entries in their original order, which is correct about coverage and '
        + 'keeps larger inputs than it needs to.',
      entry: 'lab',
      starter: [
        'function coverageOf(corpus) {',
        '  const seen = {};',
        '',
        '  corpus.forEach(function (entry) {',
        '    entry.coverage.forEach(function (edge) { seen[edge] = true; });',
        '  });',
        '  return Object.keys(seen).sort();',
        '}',
        '',
        'function minimise(corpus) {',
        '  const covered = {};',
        '  const kept = [];',
        '',
        '  // No sort: the first entry that covers an edge wins, whatever it',
        '  // costs, so a 40-byte input can keep a 2-byte one out.',
        '  corpus.forEach(function (entry) {',
        '    const fresh = entry.coverage.filter(function (edge) { return !covered[edge]; });',
        '',
        '    if (!fresh.length) return;',
        '    fresh.forEach(function (edge) { covered[edge] = true; });',
        '    kept.push(entry);',
        '  });',
        '  return { corpus: kept, before: corpus.length, after: kept.length,',
        '    coverage: Object.keys(covered).sort() };',
        '}',
        '',
        'function lab() {',
        '  return { minimise: minimise, coverageOf: coverageOf };',
        '}'
      ].join('\n'),
      solution: [
        'function coverageOf(corpus) {',
        '  const seen = {};',
        '',
        '  corpus.forEach(function (entry) {',
        '    entry.coverage.forEach(function (edge) { seen[edge] = true; });',
        '  });',
        '  return Object.keys(seen).sort();',
        '}',
        '',
        '/* Greedy set cover, smallest first. Set cover is NP-hard and greedy is',
        '   what every fuzzer ships; sorting by size is what makes the result a',
        '   corpus of small inputs, which is what makes the next campaign fast. */',
        'function minimise(corpus) {',
        '  const sorted = corpus.slice().sort(function (a, b) {',
        '    return a.input.length - b.input.length;',
        '  });',
        '  const covered = {};',
        '  const kept = [];',
        '',
        '  sorted.forEach(function (entry) {',
        '    const fresh = entry.coverage.filter(function (edge) { return !covered[edge]; });',
        '',
        '    if (!fresh.length) return;',
        '    fresh.forEach(function (edge) { covered[edge] = true; });',
        '    kept.push(entry);',
        '  });',
        '  return { corpus: kept, before: corpus.length, after: kept.length,',
        '    coverage: Object.keys(covered).sort() };',
        '}',
        '',
        'function lab() {',
        '  return { minimise: minimise, coverageOf: coverageOf };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'total coverage is unchanged',
          assert: function (lab, api) {
            const parts = lab();
            const corpus = [
              { input: 'aaaaaaaa', coverage: ['a', 'b'] },
              { input: 'bb', coverage: ['b'] },
              { input: 'c', coverage: ['a'] },
              { input: 'dddd', coverage: ['c'] }
            ];
            const out = parts.minimise(corpus);

            api.assert.deepEqual(out.coverage, parts.coverageOf(corpus),
              'a minimisation that loses an edge has lost a test');
          }
        },
        {
          name: 'the smallest input covering an edge is the one kept',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.minimise([
              { input: 'aaaaaaaa', coverage: ['a'] },
              { input: 'b', coverage: ['a'] }
            ]);

            api.assert.equal(out.after, 1, 'one entry is enough for one edge');
            api.assert.equal(out.corpus[0].input, 'b', 'and it is the smaller one');
          }
        },
        {
          name: 'an entry covering nothing new is dropped',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.minimise([
              { input: 'x', coverage: ['a', 'b'] },
              { input: 'yy', coverage: ['a'] },
              { input: 'zzz', coverage: ['b'] }
            ]);

            api.assert.equal(out.before, 3, 'three entries in');
            api.assert.equal(out.after, 1, 'and one is enough');
          }
        }
      ]
    }],

    'specifying-systems': [{
      id: 'check-a-specification',
      title: 'Compile a specification and find the shortest violation',
      prompt: 'A specification is { vars, init, actions, invariants } where an action is ' +
        '{ name, when: ["a", "!b"], then: { a: true } } and an invariant is { name, when, ' +
        'require } meaning "whenever the when conditions hold, the require ones must too". ' +
        'Write holds(conditions, state) — honouring the "!" prefix as negation — and ' +
        'check(spec) returning { violated, at, trace, states }: explore the reachable states '
        + 'breadth-first and stop at the first state where some invariant\'s `when` holds and '
        + 'its `require` does not. The starter ignores the "!" prefix, so a guard that means '
        + '"not down" is read as "down" and the reachable set is wrong.',
      entry: 'lab',
      starter: [
        'function holds(conditions, state) {',
        '  return (conditions || []).every(function (name) {',
        '    // The "!" is never stripped, so "!down" looks up a variable that',
        '    // does not exist and is read as false.',
        '    return Boolean(state[name]);',
        '  });',
        '}',
        '',
        'function broken(spec, state) {',
        '  return (spec.invariants || []).filter(function (row) {',
        '    return holds(row.when, state) && !holds(row.require, state);',
        '  })[0] || null;',
        '}',
        '',
        'function keyOf(spec, state) {',
        '  return spec.vars.map(function (name) { return state[name] ? "1" : "0"; }).join("");',
        '}',
        '',
        'function successors(spec, state) {',
        '  const out = [];',
        '',
        '  spec.actions.forEach(function (action) {',
        '    if (!holds(action.when, state)) return;',
        '    out.push({ action: action.name,',
        '      state: Object.assign({}, state, action.then || {}) });',
        '  });',
        '  return out;',
        '}',
        '',
        'function check(spec) {',
        '  const seen = {};',
        '  const queue = [{ state: spec.init,',
        '    trace: [{ action: "init", state: spec.init }] }];',
        '  let states = 0;',
        '',
        '  while (queue.length && states < 5000) {',
        '    const here = queue.shift();',
        '    const key = keyOf(spec, here.state);',
        '',
        '    if (seen[key]) continue;',
        '    seen[key] = true;',
        '    states += 1;',
        '    const bad = broken(spec, here.state);',
        '',
        '    if (bad) {',
        '      return { violated: true, at: here.trace.length - 1, trace: here.trace,',
        '        states: states, broken: bad.name };',
        '    }',
        '    successors(spec, here.state).forEach(function (step) {',
        '      queue.push({ state: step.state, trace: here.trace.concat([step]) });',
        '    });',
        '  }',
        '  return { violated: false, at: null, trace: null, states: states };',
        '}',
        '',
        'function lab() {',
        '  return { check: check, holds: holds, broken: broken };',
        '}'
      ].join('\n'),
      solution: [
        '/* The "!" prefix is the whole of the negation in this language, and',
        '   dropping it does not make guards weaker - it makes them mean the',
        '   opposite, so the reachable set is a different protocol. */',
        'function holds(conditions, state) {',
        '  return (conditions || []).every(function (name) {',
        '    if (name.charAt(0) === "!") return !state[name.slice(1)];',
        '    return Boolean(state[name]);',
        '  });',
        '}',
        '',
        'function broken(spec, state) {',
        '  return (spec.invariants || []).filter(function (row) {',
        '    return holds(row.when, state) && !holds(row.require, state);',
        '  })[0] || null;',
        '}',
        '',
        'function keyOf(spec, state) {',
        '  return spec.vars.map(function (name) { return state[name] ? "1" : "0"; }).join("");',
        '}',
        '',
        'function successors(spec, state) {',
        '  const out = [];',
        '',
        '  spec.actions.forEach(function (action) {',
        '    if (!holds(action.when, state)) return;',
        '    out.push({ action: action.name,',
        '      state: Object.assign({}, state, action.then || {}) });',
        '  });',
        '  return out;',
        '}',
        '',
        'function check(spec) {',
        '  const seen = {};',
        '  const queue = [{ state: spec.init,',
        '    trace: [{ action: "init", state: spec.init }] }];',
        '  let states = 0;',
        '',
        '  while (queue.length && states < 5000) {',
        '    const here = queue.shift();',
        '    const key = keyOf(spec, here.state);',
        '',
        '    if (seen[key]) continue;',
        '    seen[key] = true;',
        '    states += 1;',
        '    const bad = broken(spec, here.state);',
        '',
        '    if (bad) {',
        '      return { violated: true, at: here.trace.length - 1, trace: here.trace,',
        '        states: states, broken: bad.name };',
        '    }',
        '    successors(spec, here.state).forEach(function (step) {',
        '      queue.push({ state: step.state, trace: here.trace.concat([step]) });',
        '    });',
        '  }',
        '  return { violated: false, at: null, trace: null, states: states };',
        '}',
        '',
        'function lab() {',
        '  return { check: check, holds: holds, broken: broken };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a negated condition means what it says',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.holds(['!down'], { down: false }), true,
              'not down holds when down is false');
            api.assert.equal(parts.holds(['!down'], { down: true }), false,
              'and fails when it is true');
            api.assert.equal(parts.holds(['up', '!down'], { up: true, down: false }), true,
              'and both halves are checked');
          }
        },
        {
          name: 'the retry protocol applies a request twice',
          assert: function (lab, api) {
            const parts = lab();
            const spec = {
              vars: ['sent', 'lost', 'applied', 'retried', 'twice'],
              init: { sent: false, lost: false, applied: false, retried: false, twice: false },
              actions: [
                { name: 'send', when: ['!sent'], then: { sent: true } },
                { name: 'lose', when: ['sent', '!applied', '!lost'], then: { lost: true } },
                { name: 'apply', when: ['sent', '!applied'], then: { applied: true } },
                { name: 'retry', when: ['lost', '!retried'], then: { retried: true } },
                { name: 'apply again', when: ['retried', 'applied', '!twice'],
                  then: { twice: true } }
              ],
              invariants: [{ name: 'no request is applied twice', when: ['twice'],
                require: ['!twice'] }]
            };
            const out = parts.check(spec);

            api.assert.equal(out.violated, true, 'the duplicate is reachable');
            api.assert.equal(out.at, 5, 'in five steps, and breadth-first makes it the shortest');
          }
        },
        {
          name: 'removing the duplicate action makes it clean',
          assert: function (lab, api) {
            const parts = lab();
            const spec = {
              vars: ['sent', 'lost', 'applied', 'retried', 'twice'],
              init: { sent: false, lost: false, applied: false, retried: false, twice: false },
              actions: [
                { name: 'send', when: ['!sent'], then: { sent: true } },
                { name: 'lose', when: ['sent', '!applied', '!lost'], then: { lost: true } },
                { name: 'apply', when: ['sent', '!applied'], then: { applied: true } },
                { name: 'retry', when: ['lost', '!retried'], then: { retried: true } },
                { name: 'ignore the duplicate', when: ['retried', 'applied'], then: {} }
              ],
              invariants: [{ name: 'no request is applied twice', when: ['twice'],
                require: ['!twice'] }]
            };
            const out = parts.check(spec);

            api.assert.equal(out.violated, false, 'nothing applies the request twice');
            api.assert.ok(out.states >= 4, 'and the search really explored, found ' + out.states);
          }
        },
        {
          name: 'an invariant whose when never holds is never violated',
          assert: function (lab, api) {
            const parts = lab();
            const spec = {
              vars: ['a', 'b'],
              init: { a: false, b: false },
              actions: [{ name: 'set a', when: ['!a'], then: { a: true } }],
              invariants: [{ name: 'b implies a', when: ['b'], require: ['a'] }]
            };
            const out = parts.check(spec);

            api.assert.equal(out.violated, false,
              'b is never set, so the implication is vacuously true everywhere');
            api.assert.equal(out.states, 2, 'over the two reachable states');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

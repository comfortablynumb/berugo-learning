/**
 * Graded exercises for issue width, speculation and memory parallelism
 * (M36.4-M36.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'superscalar-issue': [{
      id: 'port-based-issue',
      title: 'Issue on ports, and count what the machine actually did',
      prompt: 'Write lab() returning { select, recount }. select(queue, ports, cycle) picks '
        + 'the instructions to issue this cycle: walk the queue in order - it is already '
        + 'oldest first - and take an entry when it is ready, has not issued, and some port '
        + 'whose `kinds` include the entry\'s kind has `freeAt` no later than `cycle`. Mark '
        + 'that port busy by setting freeAt to cycle + its interval, set the entry\'s issuedAt '
        + 'and port, and stop once `width` entries have been taken, where width is ports.width. '
        + 'Return the array of chosen entries. recount(log) takes an array of per-cycle event '
        + 'arrays and returns { issued, committed, peak }: the totals of events with kind '
        + '"issue" and "commit", and the most issues in any single cycle. The starter ignores '
        + 'the ports entirely, so it issues the width every cycle whatever the machine has.',
      entry: 'lab',
      starter: [
        'function select(queue, ports, cycle) {',
        '  // Width entries per cycle, with no port check at all.',
        '  var chosen = [];',
        '',
        '  queue.forEach(function (entry) {',
        '    if (chosen.length >= ports.width) return;',
        '    if (!entry.ready || entry.issuedAt !== undefined) return;',
        '    entry.issuedAt = cycle;',
        '    entry.port = "any";',
        '    chosen.push(entry);',
        '  });',
        '  return chosen;',
        '}',
        '',
        'function recount(log) {',
        '  var issued = 0;',
        '',
        '  log.forEach(function (events) { issued += events.length; });',
        '  return { issued: issued, committed: issued, peak: 0 };',
        '}',
        '',
        'function lab() {',
        '  return { select: select, recount: recount };',
        '}'
      ].join('\n'),
      solution: [
        '/* A port is free when its freeAt has arrived. The interval is not the',
        '   latency: a fully pipelined unit accepts one operation per cycle',
        '   however long its result takes, and using the latency here caps every',
        '   port at half throughput. */',
        'function portFor(ports, kind, cycle) {',
        '  var found = null;',
        '',
        '  ports.list.forEach(function (port) {',
        '    if (found) return;',
        '    if (port.kinds.indexOf(kind) === -1) return;',
        '    if (port.freeAt > cycle) return;',
        '    found = port;',
        '  });',
        '  return found;',
        '}',
        '',
        '/* Oldest ready first. Any ready instruction may be issued without',
        '   breaking correctness, so this is a pure performance choice - and the',
        '   oldest is right because it is the one most likely to be blocking the',
        '   head of the reorder buffer. */',
        'function select(queue, ports, cycle) {',
        '  var chosen = [];',
        '',
        '  queue.forEach(function (entry) {',
        '    if (chosen.length >= ports.width) return;',
        '    if (!entry.ready || entry.issuedAt !== undefined) return;',
        '',
        '    var port = portFor(ports, entry.kind, cycle);',
        '',
        '    if (!port) return;',
        '    port.freeAt = cycle + port.interval;',
        '    entry.issuedAt = cycle;',
        '    entry.port = port.name;',
        '    chosen.push(entry);',
        '  });',
        '  return chosen;',
        '}',
        '',
        '/* Recounted from the log rather than read from a counter, because a',
        '   summary and the log it summarises can drift apart. */',
        'function recount(log) {',
        '  var issued = 0;',
        '  var committed = 0;',
        '  var peak = 0;',
        '',
        '  log.forEach(function (events) {',
        '    var here = 0;',
        '',
        '    events.forEach(function (event) {',
        '      if (event.kind === "issue") { issued += 1; here += 1; }',
        '      if (event.kind === "commit") committed += 1;',
        '    });',
        '    if (here > peak) peak = here;',
        '  });',
        '  return { issued: issued, committed: committed, peak: peak };',
        '}',
        '',
        'function lab() {',
        '  return { select: select, recount: recount };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'no port issues twice in one cycle',
          assert: function (lab, api) {
            const ports = { width: 4, list: [
              { name: 'alu0', kinds: ['alu'], interval: 1, freeAt: 0 },
              { name: 'mem', kinds: ['load'], interval: 1, freeAt: 0 }
            ] };
            const queue = [0, 1, 2].map(function (id) {
              return { id: id, kind: 'alu', ready: true };
            });
            const chosen = lab().select(queue, ports, 0);

            api.assert.equal(chosen.length, 1, 'one integer unit means one integer op');
            api.assert.equal(chosen[0].id, 0, 'and the oldest ready one gets it');
          }
        },
        {
          name: 'a second port serves a different kind in the same cycle',
          assert: function (lab, api) {
            const ports = { width: 4, list: [
              { name: 'alu0', kinds: ['alu'], interval: 1, freeAt: 0 },
              { name: 'mem', kinds: ['load'], interval: 1, freeAt: 0 }
            ] };
            const queue = [{ id: 0, kind: 'alu', ready: true },
              { id: 1, kind: 'load', ready: true }];
            const chosen = lab().select(queue, ports, 0);

            api.assert.equal(chosen.length, 2, 'different kinds, different ports');
            api.assert.equal(chosen[1].port, 'mem', 'the load took the memory port');
          }
        },
        {
          name: 'a pipelined port is free again the next cycle, whatever the latency',
          assert: function (lab, api) {
            const parts = lab();
            const ports = { width: 4, list: [
              { name: 'mem', kinds: ['load'], interval: 1, freeAt: 0 }
            ] };
            const queue = [{ id: 0, kind: 'load', ready: true, latency: 2 },
              { id: 1, kind: 'load', ready: true, latency: 2 }];

            api.assert.equal(parts.select(queue, ports, 0).length, 1, 'one per cycle');
            api.assert.equal(parts.select(queue, ports, 1).length, 1,
              'and another the next cycle - the two-cycle latency does not block the port');
          }
        },
        {
          name: 'the issue width is respected even when every port is free',
          assert: function (lab, api) {
            const ports = { width: 2, list: [
              { name: 'a', kinds: ['alu'], interval: 1, freeAt: 0 },
              { name: 'b', kinds: ['alu'], interval: 1, freeAt: 0 },
              { name: 'c', kinds: ['alu'], interval: 1, freeAt: 0 }
            ] };
            const queue = [0, 1, 2].map(function (id) {
              return { id: id, kind: 'alu', ready: true };
            });

            api.assert.equal(lab().select(queue, ports, 0).length, 2,
              'three ports and a width of two issues two');
          }
        },
        {
          name: 'the recount reads the log rather than trusting a counter',
          assert: function (lab, api) {
            const log = [
              [{ kind: 'fetch' }, { kind: 'issue' }, { kind: 'issue' }],
              [{ kind: 'issue' }, { kind: 'commit' }],
              [{ kind: 'commit' }, { kind: 'commit' }, { kind: 'noIssue' }]
            ];
            const got = lab().recount(log);

            api.assert.equal(got.issued, 3, 'three issue events');
            api.assert.equal(got.committed, 3, 'three commits');
            api.assert.equal(got.peak, 2, 'the busiest cycle issued two');
          }
        }
      ]
    }],

    'speculation-and-recovery': [{
      id: 'store-set-speculation',
      title: 'Let a load pass a store, notice when it was wrong, and stop being wrong',
      prompt: 'Write lab() returning { create, mayIssue, resolveStore }. create(speculate) '
        + 'returns a queue state; entries are added to state.entries in program order as '
        + '{ id, pc, kind, address, completed } with address null until resolved. '
        + 'mayIssue(state, id) decides whether the load with that id may go now: if no older '
        + 'store has an unresolved address, yes. Otherwise, when state.speculate is false, no; '
        + 'when it is true, no if that load\'s pc is in state.storeSets, and yes otherwise. '
        + 'Return { ok: true } or { ok: false, reason }. resolveStore(state, id, address) sets '
        + 'the store\'s address, then returns the array of younger completed loads that had '
        + 'already read that address - the misspeculations - and records each of their pcs in '
        + 'state.storeSets so they wait next time. The starter always lets the load go and '
        + 'never notices.',
      entry: 'lab',
      starter: [
        'function create(speculate) {',
        '  return { entries: [], speculate: speculate, storeSets: {} };',
        '}',
        '',
        'function mayIssue(state, id) {',
        '  // Always yes. Fast, and wrong whenever the load aliases.',
        '  return { ok: true };',
        '}',
        '',
        'function resolveStore(state, id, address) {',
        '  state.entries.forEach(function (row) {',
        '    if (row.id === id) row.address = address;',
        '  });',
        '  return [];',
        '}',
        '',
        'function lab() {',
        '  return { create: create, mayIssue: mayIssue, resolveStore: resolveStore };',
        '}'
      ].join('\n'),
      solution: [
        'function create(speculate) {',
        '  return { entries: [], speculate: speculate, storeSets: {} };',
        '}',
        '',
        'function olderThan(state, id) {',
        '  var at = -1;',
        '',
        '  state.entries.forEach(function (row, index) {',
        '    if (row.id === id) at = index;',
        '  });',
        '  return at <= 0 ? [] : state.entries.slice(0, at);',
        '}',
        '',
        'function entryFor(state, id) {',
        '  var found = null;',
        '',
        '  state.entries.forEach(function (row) {',
        '    if (row.id === id) found = row;',
        '  });',
        '  return found;',
        '}',
        '',
        '/* Conservative ordering waits for every older store to have an address,',
        '   because any of them might turn out to be this one. Speculation waits',
        '   only for the loads the predictor has already seen alias - which is the',
        '   difference between waiting for every store and waiting for the one',
        '   that actually matters. */',
        'function mayIssue(state, id) {',
        '  var unresolved = 0;',
        '',
        '  olderThan(state, id).forEach(function (row) {',
        '    if (row.kind === "store" && row.address === null) unresolved += 1;',
        '  });',
        '  if (!unresolved) return { ok: true };',
        '  if (!state.speculate) {',
        '    return { ok: false, reason: "conservative ordering: " + unresolved +',
        '      " older store(s) have no address yet" };',
        '  }',
        '',
        '  var load = entryFor(state, id);',
        '',
        '  if (load && state.storeSets[load.pc]) {',
        '    return { ok: false, reason: "this load has aliased before" };',
        '  }',
        '  return { ok: true };',
        '}',
        '',
        '/* Detecting the mistake is the whole cost of speculating: the queue has',
        '   to be searched on every store. Recording the offending load is what',
        '   bounds the cost - the machine is wrong about a given load once or',
        '   twice rather than once per iteration. */',
        'function resolveStore(state, id, address) {',
        '  var record = entryFor(state, id);',
        '  var offenders = [];',
        '  var seen = false;',
        '',
        '  if (!record) return offenders;',
        '  record.address = address;',
        '  state.entries.forEach(function (row) {',
        '    if (row.id === id) { seen = true; return; }',
        '    if (!seen) return;',
        '    if (row.kind !== "load" || !row.completed) return;',
        '    if (row.address !== address) return;',
        '    state.storeSets[row.pc] = true;',
        '    offenders.push(row);',
        '  });',
        '  return offenders;',
        '}',
        '',
        'function lab() {',
        '  return { create: create, mayIssue: mayIssue, resolveStore: resolveStore };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'conservative ordering makes the load wait for an unresolved store',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(false);

            state.entries = [
              { id: 0, pc: 16, kind: 'store', address: null, completed: false },
              { id: 1, pc: 20, kind: 'load', address: null, completed: false }
            ];
            api.assert.equal(parts.mayIssue(state, 1).ok, false,
              'the store might be this address and nobody knows yet');
          }
        },
        {
          name: 'speculation lets it go, and a resolved store lets both machines go',
          assert: function (lab, api) {
            const parts = lab();
            const speculating = parts.create(true);

            speculating.entries = [
              { id: 0, pc: 16, kind: 'store', address: null, completed: false },
              { id: 1, pc: 20, kind: 'load', address: null, completed: false }
            ];
            api.assert.equal(parts.mayIssue(speculating, 1).ok, true, 'the guess is made');

            const careful = parts.create(false);

            careful.entries = [
              { id: 0, pc: 16, kind: 'store', address: 256, completed: true },
              { id: 1, pc: 20, kind: 'load', address: null, completed: false }
            ];
            api.assert.equal(parts.mayIssue(careful, 1).ok, true,
              'once the address is known there is nothing to wait for');
          }
        },
        {
          name: 'a store that lands on a completed younger load reports the misspeculation',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(true);

            state.entries = [
              { id: 0, pc: 16, kind: 'store', address: null, completed: false },
              { id: 1, pc: 20, kind: 'load', address: 256, completed: true },
              { id: 2, pc: 24, kind: 'load', address: 512, completed: true }
            ];

            const offenders = parts.resolveStore(state, 0, 256);

            api.assert.equal(offenders.length, 1, 'only the load on the same address');
            api.assert.equal(offenders[0].id, 1, 'and it is the one that read it early');
          }
        },
        {
          name: 'after a misspeculation that load waits, and every other load still goes',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(true);

            state.entries = [
              { id: 0, pc: 16, kind: 'store', address: null, completed: false },
              { id: 1, pc: 20, kind: 'load', address: 256, completed: true }
            ];
            parts.resolveStore(state, 0, 256);

            state.entries = [
              { id: 2, pc: 16, kind: 'store', address: null, completed: false },
              { id: 3, pc: 20, kind: 'load', address: null, completed: false },
              { id: 4, pc: 28, kind: 'load', address: null, completed: false }
            ];
            api.assert.equal(parts.mayIssue(state, 3).ok, false,
              'the offending load is remembered by its address in the program');
            api.assert.equal(parts.mayIssue(state, 4).ok, true,
              'and every other load still speculates freely');
          }
        },
        {
          name: 'a load that has not completed is not a misspeculation',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(true);

            state.entries = [
              { id: 0, pc: 16, kind: 'store', address: null, completed: false },
              { id: 1, pc: 20, kind: 'load', address: 256, completed: false }
            ];
            api.assert.equal(parts.resolveStore(state, 0, 256).length, 0,
              'it has not read anything yet, so it has not read anything stale');
          }
        }
      ]
    }],

    'memory-level-parallelism': [{
      id: 'mshr-allocation',
      title: 'Allocate miss registers, and measure the overlap they produce',
      prompt: 'Write lab() returning { create, begin, retire, mlp }. create(limit) returns a '
        + 'state with no outstanding misses. begin(state, request, cycle) starts an access, '
        + 'where request is { address, hit, cycles }: a hit always succeeds and returns '
        + '{ ok: true, hit: true }. A miss needs a free register - if state.outstanding is '
        + 'already at the limit return { ok: false, reason }, otherwise record the miss as '
        + 'finishing at cycle + request.cycles and return { ok: true, hit: false }. A second '
        + 'miss to an address already outstanding must NOT take a second register: it joins '
        + 'the existing one and returns { ok: true, hit: false, merged: true }. '
        + 'retire(state, cycle) drops every miss whose finish time has passed and returns how '
        + 'many remain. mlp(samples) takes an array of per-cycle outstanding counts and '
        + 'returns the average over the samples that are above zero, or 0 if there are none. '
        + 'The starter ignores the limit and never merges.',
      entry: 'lab',
      starter: [
        'function create(limit) {',
        '  return { limit: limit, outstanding: [] };',
        '}',
        '',
        'function begin(state, request, cycle) {',
        '  if (request.hit) return { ok: true, hit: true };',
        '  // No limit and no merging: every miss gets its own register, always.',
        '  state.outstanding.push({ address: request.address, until: cycle + request.cycles });',
        '  return { ok: true, hit: false };',
        '}',
        '',
        'function retire(state, cycle) {',
        '  state.outstanding = state.outstanding.filter(function (row) {',
        '    return row.until > cycle;',
        '  });',
        '  return state.outstanding.length;',
        '}',
        '',
        'function mlp(samples) {',
        '  var total = 0;',
        '',
        '  samples.forEach(function (value) { total += value; });',
        '  return samples.length ? total / samples.length : 0;',
        '}',
        '',
        'function lab() {',
        '  return { create: create, begin: begin, retire: retire, mlp: mlp };',
        '}'
      ].join('\n'),
      solution: [
        'function create(limit) {',
        '  return { limit: limit, outstanding: [] };',
        '}',
        '',
        '/* Two misses to the same line are one miss. A register records the LINE',
        '   being fetched and who is waiting for it, so merging is what the',
        '   structure is for rather than an optimisation on top of it. */',
        'function begin(state, request, cycle) {',
        '  if (request.hit) return { ok: true, hit: true };',
        '',
        '  var existing = null;',
        '',
        '  state.outstanding.forEach(function (row) {',
        '    if (row.address === request.address) existing = row;',
        '  });',
        '  if (existing) return { ok: true, hit: false, merged: true };',
        '  if (state.outstanding.length >= state.limit) {',
        '    return { ok: false, reason: "all " + state.limit + " miss registers are in use" };',
        '  }',
        '  state.outstanding.push({ address: request.address, until: cycle + request.cycles });',
        '  return { ok: true, hit: false };',
        '}',
        '',
        'function retire(state, cycle) {',
        '  state.outstanding = state.outstanding.filter(function (row) {',
        '    return row.until > cycle;',
        '  });',
        '  return state.outstanding.length;',
        '}',
        '',
        '/* Averaged over the cycles when a miss was actually outstanding.',
        '   Averaging over the whole run would report a smaller number for a',
        '   program that spent less time waiting, which is the wrong direction',
        '   for every conclusion this metric is used to reach. */',
        'function mlp(samples) {',
        '  var total = 0;',
        '  var busy = 0;',
        '',
        '  samples.forEach(function (value) {',
        '    if (value <= 0) return;',
        '    total += value;',
        '    busy += 1;',
        '  });',
        '  return busy ? total / busy : 0;',
        '}',
        '',
        'function lab() {',
        '  return { create: create, begin: begin, retire: retire, mlp: mlp };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'four misses overlap and the fifth is refused',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(4);
            let at;

            for (at = 0; at < 4; at += 1) {
              api.assert.equal(parts.begin(state, { address: at * 64, hit: false,
                cycles: 20 }, 0).ok, true, 'miss ' + at + ' takes a register');
            }
            const fifth = parts.begin(state, { address: 999, hit: false, cycles: 20 }, 0);

            api.assert.equal(fifth.ok, false, 'the registers are all in use');
            api.assert.ok(fifth.reason, 'and the reason says which structure');
          }
        },
        {
          name: 'a hit never needs a register',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(1);

            parts.begin(state, { address: 64, hit: false, cycles: 20 }, 0);
            const got = parts.begin(state, { address: 128, hit: true, cycles: 1 }, 0);

            api.assert.equal(got.ok, true, 'a hit proceeds with every register busy');
            api.assert.equal(got.hit, true, 'and it is reported as a hit');
          }
        },
        {
          name: 'a second miss to the same line joins the first rather than taking a register',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(1);

            parts.begin(state, { address: 64, hit: false, cycles: 20 }, 0);
            const merged = parts.begin(state, { address: 64, hit: false, cycles: 20 }, 1);

            api.assert.equal(merged.ok, true, 'the line is already being fetched');
            api.assert.equal(merged.merged, true, 'and it merged rather than allocating');
            api.assert.equal(state.outstanding.length, 1, 'still one register in use');
          }
        },
        {
          name: 'misses retire when their latency has passed',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(4);

            parts.begin(state, { address: 64, hit: false, cycles: 20 }, 0);
            api.assert.equal(parts.retire(state, 10), 1, 'still in flight at cycle 10');
            api.assert.equal(parts.retire(state, 20), 0, 'and finished at cycle 20');
          }
        },
        {
          name: 'the parallelism figure ignores the cycles with no memory activity',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.mlp([0, 0, 4, 4, 0, 0]), 4,
              'four in flight for the two cycles when anything was');
            api.assert.equal(parts.mlp([0, 0, 0]), 0, 'no memory activity at all');
            api.assert.equal(parts.mlp([1, 1, 1, 1]), 1,
              'a strictly serialised chase has a parallelism of exactly one');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

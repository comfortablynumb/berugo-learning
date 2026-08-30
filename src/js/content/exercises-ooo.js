/**
 * Graded exercises for ILP, dynamic scheduling and the reorder buffer
 * (M36.1-M36.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'instruction-level-parallelism': [{
      id: 'critical-path-bound',
      title: 'Compute the bound the simulator is not allowed to beat',
      prompt: 'Write lab() returning { analyse }. analyse(rows, model) takes a trace - one '
        + 'row per executed instruction, each { id, reads, writes, latency, address, access } '
        + 'with reads an array of register numbers, writes a register number or null, address '
        + 'a number or null and access "read" or "write" - and returns '
        + '{ criticalPath, ilp }. criticalPath is the longest path through the dependence '
        + 'graph in cycles, where an instruction starts when every instruction it depends on '
        + 'has finished and takes its own latency; ilp is rows.length divided by that. The '
        + 'model is "renamed" (obey read-after-write, and a load after a store to the same '
        + 'address) or "unrenamed" (also obey write-after-read and write-after-write). Rows '
        + 'are in program order and register 0 is never a dependence. The starter ignores '
        + 'memory and the name dependences, so it reports the same answer for both models.',
      entry: 'lab',
      starter: [
        'function analyse(rows, model) {',
        '  // Read-after-write only, and memory ignored entirely.',
        '  var finish = {};',
        '  var lastWrite = {};',
        '  var longest = 0;',
        '',
        '  rows.forEach(function (row) {',
        '    var start = 0;',
        '',
        '    row.reads.forEach(function (reg) {',
        '      if (reg !== 0 && finish[lastWrite[reg]] > start) start = finish[lastWrite[reg]];',
        '    });',
        '    finish[row.id] = start + row.latency;',
        '    if (row.writes) lastWrite[row.writes] = row.id;',
        '    if (finish[row.id] > longest) longest = finish[row.id];',
        '  });',
        '  return { criticalPath: longest, ilp: longest ? rows.length / longest : 0 };',
        '}',
        '',
        'function lab() {',
        '  return { analyse: analyse };',
        '}'
      ].join('\n'),
      solution: [
        '/* One forward pass. The trace is in program order and every dependence',
        '   points forwards in it, so an instruction can be finished before the',
        '   next one is looked at - no topological sort is needed. */',
        'function analyse(rows, model) {',
        '  var names = model === "unrenamed";',
        '  var finish = {};',
        '  var lastWrite = {};',
        '  var readers = {};',
        '  var lastStoreTo = {};',
        '  var longest = 0;',
        '',
        '  rows.forEach(function (row) {',
        '    var start = 0;',
        '',
        '    function after(id) {',
        '      if (id === undefined) return;',
        '      if (finish[id] > start) start = finish[id];',
        '    }',
        '',
        '    row.reads.forEach(function (reg) {',
        '      if (reg === 0) return;',
        '      after(lastWrite[reg]);',
        '      readers[reg] = (readers[reg] || []).concat([row.id]);',
        '    });',
        '',
        '    /* A load depends on the newest older store to the same address. That',
        '       is the only memory edge a renaming machine has to respect. */',
        '    if (row.address !== null && row.access === "read") after(lastStoreTo[row.address]);',
        '',
        '    /* The two name dependences, which exist only because the register',
        '       set is small. A machine with a physical file sees neither. */',
        '    if (names && row.writes) {',
        '      after(lastWrite[row.writes]);',
        '      (readers[row.writes] || []).forEach(after);',
        '    }',
        '',
        '    finish[row.id] = start + row.latency;',
        '    if (finish[row.id] > longest) longest = finish[row.id];',
        '    if (row.writes) { lastWrite[row.writes] = row.id; readers[row.writes] = []; }',
        '    if (row.address !== null && row.access === "write") lastStoreTo[row.address] = row.id;',
        '  });',
        '  return { criticalPath: longest, ilp: longest ? rows.length / longest : 0 };',
        '}',
        '',
        'function lab() {',
        '  return { analyse: analyse };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a chain of four additions has a critical path of four and a bound of 1.00',
          assert: function (lab, api) {
            const rows = [0, 1, 2, 3].map(function (at) {
              return { id: at, reads: at ? [5] : [], writes: 5, latency: 1,
                address: null, access: null };
            });
            const got = lab().analyse(rows, 'renamed');

            api.assert.equal(got.criticalPath, 4, 'each addition waits for the one before');
            api.assert.equal(got.ilp, 1, 'four instructions over four cycles');
          }
        },
        {
          name: 'four writes to one register: renaming takes the bound from 1.00 to 4.00',
          assert: function (lab, api) {
            const rows = [0, 1, 2, 3].map(function (at) {
              return { id: at, reads: [], writes: 5, latency: 1, address: null, access: null };
            });
            const parts = lab();

            api.assert.equal(parts.analyse(rows, 'renamed').ilp, 4,
              'no true dependence, so all four can start at once');
            api.assert.equal(parts.analyse(rows, 'unrenamed').criticalPath, 4,
              'a scoreboard has to order four writes to one name');
          }
        },
        {
          name: 'a load after a store to the same address is a real dependence',
          assert: function (lab, api) {
            const rows = [
              { id: 0, reads: [10], writes: null, latency: 1, address: 256, access: 'write' },
              { id: 1, reads: [10], writes: 6, latency: 2, address: 256, access: 'read' },
              { id: 2, reads: [10], writes: 7, latency: 2, address: 512, access: 'read' }
            ];
            const got = lab().analyse(rows, 'renamed');

            api.assert.equal(got.criticalPath, 3,
              'the store takes 1, then the dependent load takes 2');
          }
        },
        {
          name: 'a load from an unrelated address is not ordered against the store',
          assert: function (lab, api) {
            const rows = [
              { id: 0, reads: [10], writes: null, latency: 1, address: 256, access: 'write' },
              { id: 1, reads: [10], writes: 6, latency: 2, address: 512, access: 'read' }
            ];
            const got = lab().analyse(rows, 'renamed');

            api.assert.equal(got.criticalPath, 2, 'the load may start immediately');
            api.assert.equal(got.ilp, 1, 'two instructions over two cycles');
          }
        },
        {
          name: 'register zero is never a dependence',
          assert: function (lab, api) {
            const rows = [
              { id: 0, reads: [], writes: 0, latency: 1, address: null, access: null },
              { id: 1, reads: [0], writes: 6, latency: 1, address: null, access: null }
            ];

            api.assert.equal(lab().analyse(rows, 'unrenamed').criticalPath, 1,
              'x0 always reads zero, so nothing waits on it');
          }
        }
      ]
    }],

    'dynamic-scheduling': [{
      id: 'register-renaming',
      title: 'Build the alias table, the free list, and the rule that reclaims a register',
      prompt: 'Write lab() returning { create, allocate, commit, mapping }. create(physical) '
        + 'returns a rename state for a machine with `physical` registers, where 32 of them '
        + 'hold the architectural mapping (name i means physical register i) and the rest are '
        + 'free, lowest first. allocate(state, arch) renames a write to architectural register '
        + 'arch: it takes the lowest free physical register, points arch at it, and returns '
        + '{ phys, old } with old being what arch meant before; it returns null when nothing '
        + 'is free, and for arch 0 it returns null without changing anything. commit(state, '
        + 'dest) takes a { phys, old } from allocate and gives `old` back to the free list, '
        + 'unless old is 0, which is reserved for x0. mapping(state) returns the 32-entry '
        + 'array of physical numbers. The starter never gives a register back if its number is '
        + 'below 32.',
      entry: 'lab',
      starter: [
        'function create(physical) {',
        '  var table = [];',
        '  var free = [];',
        '  var at;',
        '',
        '  for (at = 0; at < 32; at += 1) table.push(at);',
        '  for (at = 32; at < physical; at += 1) free.push(at);',
        '  return { table: table, free: free, physical: physical };',
        '}',
        '',
        'function allocate(state, arch) {',
        '  if (arch === 0 || !state.free.length) return null;',
        '',
        '  var phys = state.free.shift();',
        '  var old = state.table[arch];',
        '',
        '  state.table[arch] = phys;',
        '  return { phys: phys, old: old };',
        '}',
        '',
        'function commit(state, dest) {',
        '  // Registers below 32 are assumed to be permanently the architectural',
        '  // mapping, which is the bug: once a name has been overwritten, the',
        '  // register it used to mean is as dead as any other.',
        '  if (!dest || dest.old < 32) return;',
        '  state.free.push(dest.old);',
        '}',
        '',
        'function mapping(state) {',
        '  return state.table.slice();',
        '}',
        '',
        'function lab() {',
        '  return { create: create, allocate: allocate, commit: commit, mapping: mapping };',
        '}'
      ].join('\n'),
      solution: [
        'function create(physical) {',
        '  var table = [];',
        '  var free = [];',
        '  var at;',
        '',
        '  for (at = 0; at < 32; at += 1) table.push(at);',
        '  for (at = 32; at < physical; at += 1) free.push(at);',
        '  return { table: table, free: free, physical: physical };',
        '}',
        '',
        'function allocate(state, arch) {',
        '  if (arch === 0 || !state.free.length) return null;',
        '',
        '  var phys = state.free.shift();',
        '  var old = state.table[arch];',
        '',
        '  state.table[arch] = phys;',
        '  return { phys: phys, old: old };',
        '}',
        '',
        '/* Every reader of the old value was renamed before the instruction that',
        '   overwrote the name, so in-order commit means they have all retired and',
        '   the register is dead. Its NUMBER is irrelevant: registers 1 to 31 are',
        '   ordinary members of the file that happen to start out mapped. Only',
        '   register 0 stays reserved, because it is what x0 means. */',
        'function commit(state, dest) {',
        '  if (!dest || !dest.old) return;',
        '  state.free.push(dest.old);',
        '}',
        '',
        'function mapping(state) {',
        '  return state.table.slice();',
        '}',
        '',
        'function lab() {',
        '  return { create: create, allocate: allocate, commit: commit, mapping: mapping };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'two writes to one name get different physical registers',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(64);
            const first = parts.allocate(state, 5);
            const second = parts.allocate(state, 5);

            api.assert.notEqual(first.phys, second.phys, 'a write allocates rather than overwrites');
            api.assert.equal(second.old, first.phys, 'the second remembers what the name meant');
            api.assert.equal(parts.mapping(state)[5], second.phys, 'the name points at the newest');
          }
        },
        {
          name: 'the free pool does not shrink over a long run',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(64);
            let at;

            for (at = 0; at < 500; at += 1) {
              const dest = parts.allocate(state, 1 + (at % 4));

              api.assert.ok(dest, 'a register was available at step ' + at);
              parts.commit(state, dest);
            }
            api.assert.equal(state.free.length, 32,
              'every committed instruction gives one register back');
          }
        },
        {
          name: 'a file with two spare registers still makes progress',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(34);
            const history = [];
            let at;

            for (at = 0; at < 20; at += 1) {
              if (history.length >= 2) parts.commit(state, history.shift());
              const dest = parts.allocate(state, 1 + (at % 4));

              api.assert.ok(dest, 'no free physical register at step ' + at +
                ' - the pool is leaking');
              history.push(dest);
            }
          }
        },
        {
          name: 'physical register 0 is never handed out',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(64);

            api.assert.equal(parts.allocate(state, 0), null, 'x0 is never renamed');
            parts.commit(state, { phys: 40, old: 0 });
            api.assert.equal(state.free.indexOf(0), -1,
              'register 0 is what x0 means and must stay reserved');
          }
        },
        {
          name: 'an exhausted file reports the stall rather than reusing a live register',
          assert: function (lab, api) {
            const parts = lab();
            const state = parts.create(34);

            parts.allocate(state, 5);
            parts.allocate(state, 6);
            api.assert.equal(parts.allocate(state, 7), null,
              'two spare registers means two renamed writes in flight');
          }
        }
      ]
    }],

    'reorder-buffer-and-precise-state': [{
      id: 'in-order-commit',
      title: 'Commit in order, retire stores, and take an exception precisely',
      prompt: 'Write lab() returning { create, dispatch, complete, commit }. '
        + 'create(capacity) returns a buffer. dispatch(rob, entry) appends '
        + '{ id, kind, address, value, fault } and returns true, or returns false when the '
        + 'buffer is full. complete(rob, id) marks that entry finished. commit(rob, memory) '
        + 'retires from the head while the head is finished, writing memory[address] = value '
        + 'for a completed store, and returns { committed, squashed, trap }: committed is the '
        + 'array of ids that retired, squashed is how many entries were discarded, and trap is '
        + 'the fault of the first faulting entry reached or null. A faulting entry itself '
        + 'retires - it is the instruction the handler is told about - and everything younger '
        + 'is squashed. The starter commits anything finished regardless of order and writes '
        + 'stores at dispatch.',
      entry: 'lab',
      starter: [
        'function create(capacity) {',
        '  return { entries: [], capacity: capacity };',
        '}',
        '',
        'function dispatch(rob, entry, memory) {',
        '  if (rob.entries.length >= rob.capacity) return false;',
        '  entry.done = false;',
        '  rob.entries.push(entry);',
        '  return true;',
        '}',
        '',
        'function complete(rob, id) {',
        '  rob.entries.forEach(function (entry) {',
        '    if (entry.id === id) entry.done = true;',
        '  });',
        '}',
        '',
        'function commit(rob, memory) {',
        '  // Anything finished, in whatever order it finished. That is exactly',
        '  // the guarantee the reorder buffer exists to provide, discarded.',
        '  var committed = [];',
        '',
        '  rob.entries = rob.entries.filter(function (entry) {',
        '    if (!entry.done) return true;',
        '    if (entry.kind === "store") memory[entry.address] = entry.value;',
        '    committed.push(entry.id);',
        '    return false;',
        '  });',
        '  return { committed: committed, squashed: 0, trap: null };',
        '}',
        '',
        'function lab() {',
        '  return { create: create, dispatch: dispatch, complete: complete, commit: commit };',
        '}'
      ].join('\n'),
      solution: [
        'function create(capacity) {',
        '  return { entries: [], capacity: capacity };',
        '}',
        '',
        'function dispatch(rob, entry) {',
        '  if (rob.entries.length >= rob.capacity) return false;',
        '  entry.done = false;',
        '  rob.entries.push(entry);',
        '  return true;',
        '}',
        '',
        'function complete(rob, id) {',
        '  rob.entries.forEach(function (entry) {',
        '    if (entry.id === id) entry.done = true;',
        '  });',
        '}',
        '',
        '/* Only the head, and only while the head is finished. Everything else in',
        '   the buffer has happened and has not become real, which is the whole',
        '   distinction the structure exists to maintain. A store writes memory',
        '   here and nowhere earlier: a speculative write could not be undone. */',
        'function commit(rob, memory) {',
        '  var committed = [];',
        '  var squashed = 0;',
        '  var trap = null;',
        '',
        '  while (rob.entries.length && rob.entries[0].done) {',
        '    var head = rob.entries.shift();',
        '',
        '    if (head.kind === "store") memory[head.address] = head.value;',
        '    committed.push(head.id);',
        '    if (head.fault) {',
        '      trap = head.fault;',
        '      squashed = rob.entries.length;',
        '      rob.entries = [];',
        '      break;',
        '    }',
        '  }',
        '  return { committed: committed, squashed: squashed, trap: trap };',
        '}',
        '',
        'function lab() {',
        '  return { create: create, dispatch: dispatch, complete: complete, commit: commit };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'finishing out of order does not commit out of order',
          assert: function (lab, api) {
            const parts = lab();
            const rob = parts.create(8);
            const memory = {};

            [0, 1, 2, 3].forEach(function (id) {
              parts.dispatch(rob, { id: id, kind: 'alu', address: null, value: id,
                fault: null });
            });
            parts.complete(rob, 2);
            parts.complete(rob, 3);
            api.assert.deepEqual(parts.commit(rob, memory).committed, [],
              'nothing may retire while an older instruction is unfinished');
            parts.complete(rob, 0);
            parts.complete(rob, 1);
            api.assert.deepEqual(parts.commit(rob, memory).committed, [0, 1, 2, 3],
              'and then all four, oldest first');
          }
        },
        {
          name: 'a store writes memory at commit and not before',
          assert: function (lab, api) {
            const parts = lab();
            const rob = parts.create(8);
            const memory = {};

            parts.dispatch(rob, { id: 0, kind: 'alu', address: null, value: 0, fault: null });
            parts.dispatch(rob, { id: 1, kind: 'store', address: 256, value: 99, fault: null });
            parts.complete(rob, 1);
            parts.commit(rob, memory);
            api.assert.equal(memory[256], undefined,
              'the store finished, and an older instruction has not');
            parts.complete(rob, 0);
            parts.commit(rob, memory);
            api.assert.equal(memory[256], 99, 'now it is real');
          }
        },
        {
          name: 'an exception retires the faulting instruction and squashes everything younger',
          assert: function (lab, api) {
            const parts = lab();
            const rob = parts.create(8);
            const memory = {};

            parts.dispatch(rob, { id: 0, kind: 'alu', address: null, value: 0, fault: null });
            parts.dispatch(rob, { id: 1, kind: 'alu', address: null, value: 1,
              fault: { cause: 6 } });
            parts.dispatch(rob, { id: 2, kind: 'store', address: 512, value: 7, fault: null });
            [0, 1, 2].forEach(function (id) { parts.complete(rob, id); });

            const got = parts.commit(rob, memory);

            api.assert.deepEqual(got.committed, [0, 1], 'the faulting instruction retires');
            api.assert.equal(got.squashed, 1, 'the younger store is discarded');
            api.assert.equal(got.trap.cause, 6, 'and the handler is told which fault');
            api.assert.equal(memory[512], undefined,
              'a store younger than a fault must never become visible');
          }
        },
        {
          name: 'a full buffer refuses a dispatch rather than dropping an entry',
          assert: function (lab, api) {
            const parts = lab();
            const rob = parts.create(2);

            api.assert.equal(parts.dispatch(rob, { id: 0, kind: 'alu', address: null,
              value: 0, fault: null }), true, 'room for the first');
            api.assert.equal(parts.dispatch(rob, { id: 1, kind: 'alu', address: null,
              value: 1, fault: null }), true, 'and the second');
            api.assert.equal(parts.dispatch(rob, { id: 2, kind: 'alu', address: null,
              value: 2, fault: null }), false, 'and no room for the third');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

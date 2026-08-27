/**
 * Graded exercises for bytecode, the VM, selection and allocation (M30.1-M30.4).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 * Each exercise exposes its functions through a single `lab()` entry, because
 * the sandbox hands a test exactly one value.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'bytecode-design': [{
      id: 'virtual-registers',
      title: 'Allocate virtual registers, and keep the scratch out of the way',
      prompt: 'A block is a list of instructions, each { op, dest, reads } where `reads` is a ' +
        'list of register names and `dest` may be absent. A call is { op: "call", dest, ' +
        'callee, args } and its arguments must end up in CONSECUTIVE registers. Write ' +
        'allocate(block, params) returning { assignment, registers, moves, calls }: ' +
        '`assignment` maps each value to its register number, `registers` is the high-water ' +
        'mark, `moves` is the number of argument moves emitted, and `calls` has one row per ' +
        'call as { at, callee, base, count } where `base` is the first of the consecutive ' +
        'argument registers. Parameters take registers 0 upwards and keep them; any other ' +
        'value is freed at its last use in the block and its register recycled. A call takes ' +
        'its argument run from ABOVE every permanent register, so `base` is never a register ' +
        'holding a live value — the callee included. The starter retires the callee before ' +
        'laying out the arguments, so the first argument reuses the register the call is about ' +
        'to read.',
      entry: 'lab',
      starter: [
        'function lastUses(block) {',
        '  const last = {};',
        '',
        '  block.forEach(function (inst, at) {',
        '    (inst.reads || []).forEach(function (name) { last[name] = at; });',
        '    (inst.args || []).forEach(function (name) { last[name] = at; });',
        '    if (inst.callee) last[inst.callee] = at;',
        '  });',
        '  return last;',
        '}',
        '',
        'function allocate(block, params) {',
        '  const last = lastUses(block);',
        '  const assignment = {};',
        '  const calls = [];',
        '  const free = [];',
        '  let next = params.length;',
        '  let high = params.length;',
        '  let moves = 0;',
        '',
        '  params.forEach(function (name, at) { assignment[name] = at; });',
        '  block.forEach(function (inst, at) {',
        '    if (inst.op === "call") {',
        '      // The callee is retired before the argument run is chosen, so the',
        '      // first argument reuses the register the call is about to read.',
        '      if (last[inst.callee] === at && assignment[inst.callee] !== undefined) {',
        '        free.push(assignment[inst.callee]);',
        '      }',
        '      const base = free.length ? free.pop() : next;',
        '',
        '      calls.push({ at: at, callee: assignment[inst.callee], base: base,',
        '        count: inst.args.length });',
        '      high = Math.max(high, base + inst.args.length);',
        '      moves += inst.args.length;',
        '    }',
        '    if (inst.dest !== undefined && assignment[inst.dest] === undefined) {',
        '      assignment[inst.dest] = free.length ? free.pop() : next++;',
        '      high = Math.max(high, next);',
        '    }',
        '    (inst.reads || []).concat(inst.args || []).forEach(function (name) {',
        '      if (params.indexOf(name) !== -1) return;',
        '      if (last[name] === at && assignment[name] !== undefined) free.push(assignment[name]);',
        '    });',
        '  });',
        '  return { assignment: assignment, registers: high, moves: moves, calls: calls };',
        '}',
        '',
        'function lab() {',
        '  return { allocate: allocate, lastUses: lastUses };',
        '}'
      ].join('\n'),
      solution: [
        'function lastUses(block) {',
        '  const last = {};',
        '',
        '  block.forEach(function (inst, at) {',
        '    (inst.reads || []).forEach(function (name) { last[name] = at; });',
        '    (inst.args || []).forEach(function (name) { last[name] = at; });',
        '    if (inst.callee) last[inst.callee] = at;',
        '  });',
        '  return last;',
        '}',
        '',
        'function retire(state, inst, at, params) {',
        '  const names = (inst.reads || []).concat(inst.args || []);',
        '',
        '  if (inst.callee) names.push(inst.callee);',
        '  names.forEach(function (name) {',
        '    if (params.indexOf(name) !== -1) return;',
        '    if (state.last[name] !== at) return;',
        '    if (state.assignment[name] === undefined) return;',
        '    if (state.free.indexOf(state.assignment[name]) === -1) {',
        '      state.free.push(state.assignment[name]);',
        '    }',
        '  });',
        '}',
        '',
        'function define(state, name) {',
        '  if (state.assignment[name] !== undefined) return state.assignment[name];',
        '  state.assignment[name] = state.free.length ? state.free.pop() : state.permanent++;',
        '  state.high = Math.max(state.high, state.permanent);',
        '  return state.assignment[name];',
        '}',
        '',
        'function allocate(block, params) {',
        '  const state = { assignment: {}, free: [], permanent: params.length,',
        '    high: params.length, moves: 0, calls: [], last: lastUses(block) };',
        '',
        '  params.forEach(function (name, at) { state.assignment[name] = at; });',
        '  block.forEach(function (inst, at) {',
        '    if (inst.dest !== undefined) define(state, inst.dest);',
        '    if (inst.op === "call") {',
        '      // Scratch is always ABOVE every permanent register, and is chosen',
        '      // before anything at this instruction is retired.',
        '      state.calls.push({ at: at, callee: state.assignment[inst.callee],',
        '        base: state.permanent, count: inst.args.length });',
        '      state.high = Math.max(state.high, state.permanent + inst.args.length);',
        '      state.moves += inst.args.length;',
        '    }',
        '    retire(state, inst, at, params);',
        '  });',
        '  return { assignment: state.assignment, registers: state.high, moves: state.moves,',
        '    calls: state.calls };',
        '}',
        '',
        'function lab() {',
        '  return { allocate: allocate, lastUses: lastUses };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a call reserves its arguments above every permanent register',
          assert: function (lab, api) {
            const parts = lab();
            const block = [
              { op: 'const', dest: 'c' },
              { op: 'const', dest: 'a0' },
              { op: 'const', dest: 'a1' },
              { op: 'call', dest: 'r', callee: 'c', args: ['a0', 'a1'] },
              { op: 'use', reads: ['r'] }
            ];
            const out = parts.allocate(block, []);

            api.assert.equal(out.moves, 2, 'one move per argument');
            api.assert.equal(out.calls.length, 1, 'one call');
            const call = out.calls[0];

            api.assert.ok(call.base > call.callee,
              'the argument run must sit above the callee register, got base ' + call.base
                + ' against callee ' + call.callee);
            api.assert.ok(call.base >= 3,
              'three values are live across the call, so the run starts at 3 or higher, got '
                + call.base);
          }
        },
        {
          name: 'a value dead at its last use has its register recycled',
          assert: function (lab, api) {
            const parts = lab();
            const block = [
              { op: 'const', dest: 'x' },
              { op: 'use', dest: 'y', reads: ['x'] },
              { op: 'use', dest: 'z', reads: ['y'] }
            ];
            const out = parts.allocate(block, []);

            api.assert.equal(out.registers, 2,
              'x dies at its use, so two registers suffice for three values');
            api.assert.equal(out.assignment.x, 0);
          }
        },
        {
          name: 'parameters keep their registers for the whole block',
          assert: function (lab, api) {
            const parts = lab();
            const block = [
              { op: 'use', dest: 't', reads: ['p'] },
              { op: 'use', dest: 'u', reads: ['t'] },
              { op: 'use', reads: ['p', 'u'] }
            ];
            const out = parts.allocate(block, ['p']);

            api.assert.equal(out.assignment.p, 0, 'the parameter takes register 0');
            api.assert.ok(out.assignment.t !== 0,
              'a parameter read later must not be recycled after its first use');
          }
        }
      ]
    }],

    'building-the-interpreter': [{
      id: 'upvalues',
      title: 'Capture upvalues, and close them when the frame returns',
      prompt: 'A frame is { slots: {} }. Write makeClosure(frame, names, byReference) returning ' +
        '{ captures } where each capture is { name, value } for a by-value capture, and ' +
        '{ name, frame, closed: false } for a by-reference one. Write readCapture(capture) ' +
        'returning the value: a by-value capture returns its stored value, an OPEN by-reference ' +
        'capture reads the frame\'s slot right now, and a CLOSED one returns the value copied ' +
        'in. Write closeFrame(frame, captures) which, for every open capture pointing at that ' +
        'frame, copies the slot value into the capture and marks it closed. The starter never ' +
        'closes anything, so a by-reference capture keeps reading a frame that has returned — ' +
        'and later writes to the same frame object change what the closure sees.',
      entry: 'lab',
      starter: [
        'function makeClosure(frame, names, byReference) {',
        '  return {',
        '    captures: names.map(function (name) {',
        '      if (!byReference) return { name: name, value: frame.slots[name] };',
        '      return { name: name, frame: frame, closed: false };',
        '    })',
        '  };',
        '}',
        '',
        'function readCapture(capture) {',
        '  if (capture.frame) return capture.frame.slots[capture.name];',
        '  return capture.value;',
        '}',
        '',
        'function closeFrame(frame, captures) {',
        '  // Nothing happens, so an open capture keeps reading a dead frame.',
        '  return captures.length;',
        '}',
        '',
        'function lab() {',
        '  return { makeClosure: makeClosure, readCapture: readCapture, closeFrame: closeFrame };',
        '}'
      ].join('\n'),
      solution: [
        'function makeClosure(frame, names, byReference) {',
        '  return {',
        '    captures: names.map(function (name) {',
        '      if (!byReference) return { name: name, value: frame.slots[name] };',
        '      return { name: name, frame: frame, closed: false };',
        '    })',
        '  };',
        '}',
        '',
        'function readCapture(capture) {',
        '  if (!capture.frame) return capture.value;',
        '  if (capture.closed) return capture.value;',
        '  return capture.frame.slots[capture.name];',
        '}',
        '',
        'function closeFrame(frame, captures) {',
        '  let closed = 0;',
        '',
        '  captures.forEach(function (capture) {',
        '    if (!capture.frame || capture.closed || capture.frame !== frame) return;',
        '    capture.value = frame.slots[capture.name];',
        '    capture.closed = true;',
        '    capture.frame = frame;',
        '    closed += 1;',
        '  });',
        '  return closed;',
        '}',
        '',
        'function lab() {',
        '  return { makeClosure: makeClosure, readCapture: readCapture, closeFrame: closeFrame };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a closed capture keeps the value the frame had when it returned',
          assert: function (lab, api) {
            const parts = lab();
            const frame = { slots: { n: 1 } };
            const closure = parts.makeClosure(frame, ['n'], true);

            api.assert.equal(parts.readCapture(closure.captures[0]), 1, 'open, reads the slot');
            frame.slots.n = 2;
            api.assert.equal(parts.readCapture(closure.captures[0]), 2,
              'still open, so it sees the write');
            api.assert.equal(parts.closeFrame(frame, closure.captures), 1, 'one capture closed');
            frame.slots.n = 99;
            api.assert.equal(parts.readCapture(closure.captures[0]), 2,
              'closed, so a later write to the dead frame changes nothing');
          }
        },
        {
          name: 'by-value capture takes a copy immediately',
          assert: function (lab, api) {
            const parts = lab();
            const frame = { slots: { n: 5 } };
            const closure = parts.makeClosure(frame, ['n'], false);

            frame.slots.n = 6;
            api.assert.equal(parts.readCapture(closure.captures[0]), 5,
              'the copy was taken when the closure was made');
            api.assert.equal(parts.closeFrame(frame, closure.captures), 0,
              'there is nothing to close');
          }
        },
        {
          name: 'three closures over one loop variable, both ways round',
          assert: function (lab, api) {
            const parts = lab();
            const frame = { slots: { i: 0 } };
            const shared = [];
            const copied = [];

            for (let at = 0; at < 3; at += 1) {
              frame.slots.i = at;
              shared.push(parts.makeClosure(frame, ['i'], true));
              copied.push(parts.makeClosure(frame, ['i'], false));
            }
            shared.forEach(function (closure) {
              parts.closeFrame(frame, closure.captures);
            });
            api.assert.deepEqual(shared.map(function (c) {
              return parts.readCapture(c.captures[0]);
            }), [2, 2, 2], 'by reference, every closure sees the last value');
            api.assert.deepEqual(copied.map(function (c) {
              return parts.readCapture(c.captures[0]);
            }), [0, 1, 2], 'by value, each sees its own');
          }
        }
      ]
    }],

    'instruction-selection': [{
      id: 'tile-cover',
      title: 'Cover the tree with the cheapest tiles, not the first ones that match',
      prompt: 'A tree node is { op, children }. A tile is { id, op, holes, cost } where `holes` ' +
        'is a list of child indices the tile leaves exposed and every other child is consumed ' +
        'by the tile itself — so a tile with op "add" and holes [0, 1] covers one node, and one ' +
        'with op "add", inner { at: 1, op: "mul" } and holes [0] covers two. Write ' +
        'cover(node, tiles) returning { cost, tiles } where `tiles` is the chosen tile ids in ' +
        'emission order, innermost first. Match a tile when its op equals the node\'s and, if ' +
        'it names an inner node, the child at that position has the inner op. The cheapest ' +
        'cover wins. The starter takes the FIRST matching tile, which is a valid cover at a ' +
        'higher cost — exactly what a target with no better option looks like.',
      entry: 'lab',
      starter: [
        'function matches(tile, node) {',
        '  if (tile.op !== node.op) return false;',
        '  if (!tile.inner) return true;',
        '  const child = node.children[tile.inner.at];',
        '',
        '  return Boolean(child) && child.op === tile.inner.op;',
        '}',
        '',
        'function holesOf(tile, node) {',
        '  const out = [];',
        '',
        '  tile.holes.forEach(function (at) {',
        '    if (tile.inner && at >= 100) {',
        '      out.push(node.children[tile.inner.at].children[at - 100]);',
        '      return;',
        '    }',
        '    out.push(node.children[at]);',
        '  });',
        '  return out;',
        '}',
        '',
        'function cover(node, tiles) {',
        '  const found = tiles.filter(function (tile) { return matches(tile, node); });',
        '',
        '  if (!found.length) throw new Error("no tile matches " + node.op);',
        '  // The first match wins, so a cheaper deeper tile later in the table',
        '  // is never considered.',
        '  const tile = found[0];',
        '  const parts = holesOf(tile, node).map(function (hole) { return cover(hole, tiles); });',
        '',
        '  return {',
        '    cost: tile.cost + parts.reduce(function (sum, part) { return sum + part.cost; }, 0),',
        '    tiles: parts.reduce(function (into, part) {',
        '      return into.concat(part.tiles);',
        '    }, []).concat([tile.id])',
        '  };',
        '}',
        '',
        'function lab() {',
        '  return { cover: cover, matches: matches };',
        '}'
      ].join('\n'),
      solution: [
        'function matches(tile, node) {',
        '  if (tile.op !== node.op) return false;',
        '  if (!tile.inner) return true;',
        '  const child = node.children[tile.inner.at];',
        '',
        '  return Boolean(child) && child.op === tile.inner.op;',
        '}',
        '',
        'function holesOf(tile, node) {',
        '  const out = [];',
        '',
        '  tile.holes.forEach(function (at) {',
        '    if (tile.inner && at >= 100) {',
        '      out.push(node.children[tile.inner.at].children[at - 100]);',
        '      return;',
        '    }',
        '    out.push(node.children[at]);',
        '  });',
        '  return out;',
        '}',
        '',
        'function optionFor(tile, node, tiles) {',
        '  const parts = holesOf(tile, node).map(function (hole) { return cover(hole, tiles); });',
        '',
        '  return {',
        '    cost: tile.cost + parts.reduce(function (sum, part) { return sum + part.cost; }, 0),',
        '    tiles: parts.reduce(function (into, part) {',
        '      return into.concat(part.tiles);',
        '    }, []).concat([tile.id])',
        '  };',
        '}',
        '',
        'function cover(node, tiles) {',
        '  const options = tiles.filter(function (tile) {',
        '    return matches(tile, node);',
        '  }).map(function (tile) { return optionFor(tile, node, tiles); });',
        '',
        '  if (!options.length) throw new Error("no tile matches " + node.op);',
        '  return options.reduce(function (best, option) {',
        '    return option.cost < best.cost ? option : best;',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { cover: cover, matches: matches };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the fused tile wins when it is cheaper than the pieces',
          assert: function (lab, api) {
            const parts = lab();
            const tree = { op: 'add', children: [
              { op: 'reg', children: [] },
              { op: 'mul', children: [{ op: 'reg', children: [] }, { op: 'reg', children: [] }] }
            ] };
            const tiles = [
              { id: 'REG', op: 'reg', holes: [], cost: 1 },
              { id: 'ADD', op: 'add', holes: [0, 1], cost: 1 },
              { id: 'MUL', op: 'mul', holes: [0, 1], cost: 3 },
              { id: 'MADD', op: 'add', inner: { at: 1, op: 'mul' }, holes: [0, 100, 101],
                cost: 3 }
            ];
            const out = parts.cover(tree, tiles);

            api.assert.equal(out.cost, 6, 'MADD at 3 plus three registers beats ADD plus MUL at 7');
            api.assert.ok(out.tiles.indexOf('MADD') !== -1, 'and the fused tile was chosen');
          }
        },
        {
          name: 'the fused tile loses when its price rises',
          assert: function (lab, api) {
            const parts = lab();
            const tree = { op: 'add', children: [
              { op: 'reg', children: [] },
              { op: 'mul', children: [{ op: 'reg', children: [] }, { op: 'reg', children: [] }] }
            ] };
            const tiles = [
              { id: 'REG', op: 'reg', holes: [], cost: 1 },
              { id: 'ADD', op: 'add', holes: [0, 1], cost: 1 },
              { id: 'MUL', op: 'mul', holes: [0, 1], cost: 3 },
              { id: 'MADD', op: 'add', inner: { at: 1, op: 'mul' }, holes: [0, 100, 101],
                cost: 9 }
            ];
            const out = parts.cover(tree, tiles);

            api.assert.equal(out.cost, 7, 'ADD plus MUL plus three registers');
            api.assert.equal(out.tiles.indexOf('MADD'), -1, 'the fused tile is not worth it');
          }
        },
        {
          name: 'the answer is the minimum, not the first match in table order',
          assert: function (lab, api) {
            const parts = lab();
            const tree = { op: 'add', children: [
              { op: 'reg', children: [] }, { op: 'reg', children: [] }
            ] };
            const tiles = [
              { id: 'REG', op: 'reg', holes: [], cost: 1 },
              { id: 'ADD_SLOW', op: 'add', holes: [0, 1], cost: 6 },
              { id: 'ADD_FAST', op: 'add', holes: [0, 1], cost: 1 }
            ];
            const out = parts.cover(tree, tiles);

            api.assert.equal(out.cost, 3, 'the cheap add plus two registers');
            api.assert.ok(out.tiles.indexOf('ADD_FAST') !== -1,
              'taking the first match would have chosen the slow one');
          }
        }
      ]
    }],

    'register-allocation': [{
      id: 'linear-scan',
      title: 'Spill the interval that ends last, and split what is left',
      prompt: 'An interval is { name, from, to }. Write scan(intervals, registers, split) ' +
        'returning { placements, spilledPoints } where each placement is { name, from, to, ' +
        'colour } and a null colour means the value is in memory over that span. Process the ' +
        'intervals in order of `from`. Expire anything that has ended, then hand out a free ' +
        'register. When none is free, compare the incoming interval against the ACTIVE one ' +
        'that ends last: if the incoming ends later, place it spilled; otherwise take the ' +
        'active one\'s register, truncate its placement to end just before this point, and ' +
        'giving the rest of its life a spilled placement — or, when `split` is true, spilling ' +
        'only up to the first point at which some ACTIVE interval has ended and re-queueing ' +
        'the tail from there, so the second half can get a register of its own. Resuming one ' +
        'point later instead puts the tail back where nothing has expired, and it spills again ' +
        'immediately. `spilledPoints` is the total span of placements with a null colour. The ' +
        'starter always spills the incoming interval, which is the greedy choice that frees ' +
        'the least space.',
      entry: 'lab',
      starter: [
        'function scan(intervals, registers, split) {',
        '  const queue = intervals.slice().sort(function (a, b) { return a.from - b.from; });',
        '  const free = [];',
        '  const active = [];',
        '  const placements = [];',
        '',
        '  for (let at = 0; at < registers; at += 1) free.push(at);',
        '  while (queue.length) {',
        '    const interval = queue.shift();',
        '',
        '    for (let at = active.length - 1; at >= 0; at -= 1) {',
        '      if (active[at].to >= interval.from) continue;',
        '      free.push(active[at].colour);',
        '      active.splice(at, 1);',
        '    }',
        '    free.sort(function (a, b) { return a - b; });',
        '    if (free.length) {',
        '      const row = { name: interval.name, from: interval.from, to: interval.to,',
        '        colour: free.shift() };',
        '',
        '      placements.push(row);',
        '      active.push({ to: interval.to, colour: row.colour, row: row });',
        '      active.sort(function (a, b) { return a.to - b.to; });',
        '      continue;',
        '    }',
        '    // Always spill the new one, whatever the active intervals look like.',
        '    placements.push({ name: interval.name, from: interval.from, to: interval.to,',
        '      colour: null });',
        '  }',
        '  return { placements: placements, spilledPoints: spilledPoints(placements) };',
        '}',
        '',
        'function spilledPoints(placements) {',
        '  return placements.reduce(function (sum, row) {',
        '    if (row.colour !== null) return sum;',
        '    return sum + (row.to - row.from + 1);',
        '  }, 0);',
        '}',
        '',
        'function lab() {',
        '  return { scan: scan, spilledPoints: spilledPoints };',
        '}'
      ].join('\n'),
      solution: [
        'function expire(state, at) {',
        '  for (let index = state.active.length - 1; index >= 0; index -= 1) {',
        '    if (state.active[index].to >= at) continue;',
        '    state.free.push(state.active[index].colour);',
        '    state.active.splice(index, 1);',
        '  }',
        '  state.free.sort(function (a, b) { return a - b; });',
        '}',
        '',
        'function place(state, interval, colour) {',
        '  const row = { name: interval.name, from: interval.from, to: interval.to,',
        '    colour: colour };',
        '',
        '  state.placements.push(row);',
        '  if (colour === null) return;',
        '  state.active.push({ name: interval.name, to: interval.to, colour: colour, row: row });',
        '  state.active.sort(function (a, b) { return a.to - b.to; });',
        '}',
        '',
        'function nextFreePoint(state) {',
        '  return state.active.reduce(function (soonest, entry) {',
        '    return Math.min(soonest, entry.to);',
        '  }, Infinity) + 1;',
        '}',
        '',
        'function remainder(state, evicted, at, queue) {',
        '  const resume = Math.max(at + 1, nextFreePoint(state));',
        '',
        '  if (!state.split || evicted.to <= resume) {',
        '    state.placements.push({ name: evicted.name, from: at, to: evicted.to,',
        '      colour: null });',
        '    return;',
        '  }',
        '  state.placements.push({ name: evicted.name, from: at, to: resume - 1, colour: null });',
        '  queue.push({ name: evicted.name, from: resume, to: evicted.to });',
        '  queue.sort(function (a, b) { return a.from - b.from; });',
        '}',
        '',
        'function spillAt(state, interval, queue) {',
        '  const last = state.active[state.active.length - 1];',
        '',
        '  if (!last || last.to <= interval.to) { place(state, interval, null); return; }',
        '  last.row.to = interval.from - 1;',
        '  if (last.row.to < last.row.from) {',
        '    state.placements.splice(state.placements.indexOf(last.row), 1);',
        '  }',
        '  state.active.pop();',
        '  place(state, interval, last.colour);',
        '  remainder(state, last, interval.from, queue);',
        '}',
        '',
        'function scan(intervals, registers, split) {',
        '  const queue = intervals.slice().sort(function (a, b) { return a.from - b.from; });',
        '  const state = { free: [], active: [], placements: [], split: Boolean(split) };',
        '  let guard = 0;',
        '',
        '  for (let at = 0; at < registers; at += 1) state.free.push(at);',
        '  while (queue.length && guard < 2000) {',
        '    const interval = queue.shift();',
        '',
        '    guard += 1;',
        '    expire(state, interval.from);',
        '    if (state.free.length) { place(state, interval, state.free.shift()); continue; }',
        '    spillAt(state, interval, queue);',
        '  }',
        '  return { placements: state.placements,',
        '    spilledPoints: spilledPoints(state.placements) };',
        '}',
        '',
        'function spilledPoints(placements) {',
        '  return placements.reduce(function (sum, row) {',
        '    if (row.colour !== null) return sum;',
        '    return sum + (row.to - row.from + 1);',
        '  }, 0);',
        '}',
        '',
        'function lab() {',
        '  return { scan: scan, spilledPoints: spilledPoints };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the interval that ends last is the one spilled',
          assert: function (lab, api) {
            const parts = lab();
            const intervals = [
              { name: 'long', from: 0, to: 20 },
              { name: 'a', from: 1, to: 3 },
              { name: 'b', from: 2, to: 4 }
            ];
            const out = parts.scan(intervals, 2, false);
            const spilled = out.placements.filter(function (row) { return row.colour === null; });

            api.assert.ok(spilled.length > 0, 'something has to spill with two registers');
            api.assert.equal(spilled[0].name, 'long',
              'the long interval frees the most space, so it is the one to evict');
          }
        },
        {
          name: 'splitting keeps the head of an evicted interval in its register',
          assert: function (lab, api) {
            const parts = lab();
            const intervals = [
              { name: 'long', from: 0, to: 20 },
              { name: 'a', from: 1, to: 2 },
              { name: 'b', from: 1, to: 3 }
            ];
            const plain = parts.scan(intervals, 2, false);
            const split = parts.scan(intervals, 2, true);

            api.assert.ok(split.spilledPoints < plain.spilledPoints,
              'splitting should spend fewer points in memory, got ' + split.spilledPoints
                + ' against ' + plain.spilledPoints);
            const head = split.placements.filter(function (row) {
              return row.name === 'long' && row.colour !== null;
            })[0];

            api.assert.ok(head && head.from === 0,
              'the head of the evicted interval keeps its register from the start');
          }
        },
        {
          name: 'nothing spills when there are enough registers',
          assert: function (lab, api) {
            const parts = lab();
            const intervals = [
              { name: 'a', from: 0, to: 4 },
              { name: 'b', from: 1, to: 5 },
              { name: 'c', from: 2, to: 6 }
            ];
            const out = parts.scan(intervals, 3, true);

            api.assert.equal(out.spilledPoints, 0, 'three registers for three live values');
            api.assert.equal(out.placements.length, 3, 'and no interval was split');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

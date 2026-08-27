/**
 * Graded exercises for scheduling, WebAssembly and the JIT (M30.5-M30.7).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'machine-scheduling': [{
      id: 'list-schedule',
      title: 'Schedule by the critical path, and prove the order is legal',
      prompt: 'A block is a list of instructions, each { id, reads, dest, latency }. Write ' +
        'dag(block) returning one node per instruction as { at, preds, succs, latency }, with ' +
        'an edge from a producer to every later instruction that reads its result. Write ' +
        'heights(nodes) returning, for each node, its latency plus the largest height among ' +
        'its successors — the longest latency-weighted path to the end. Write ' +
        'schedule(block) returning the instruction indices in issue order, always taking the ' +
        'READY instruction with the greatest height and breaking ties by index. Write ' +
        'legal(block, order) returning true when every edge still points forwards. The starter ' +
        'schedules in source order, which is legal and no better.',
      entry: 'lab',
      starter: [
        'function dag(block) {',
        '  const nodes = block.map(function (inst, at) {',
        '    return { at: at, preds: [], succs: [], latency: inst.latency || 1 };',
        '  });',
        '  const producer = {};',
        '',
        '  block.forEach(function (inst, at) {',
        '    (inst.reads || []).forEach(function (name) {',
        '      if (producer[name] === undefined) return;',
        '      nodes[producer[name]].succs.push(at);',
        '      nodes[at].preds.push(producer[name]);',
        '    });',
        '    if (inst.dest !== undefined) producer[inst.dest] = at;',
        '  });',
        '  return nodes;',
        '}',
        '',
        'function heights(nodes) {',
        '  const out = nodes.map(function () { return 0; });',
        '',
        '  for (let at = nodes.length - 1; at >= 0; at -= 1) {',
        '    out[at] = nodes[at].latency + nodes[at].succs.reduce(function (most, next) {',
        '      return Math.max(most, out[next]);',
        '    }, 0);',
        '  }',
        '  return out;',
        '}',
        '',
        'function schedule(block) {',
        '  // Source order: legal, and exactly what the pass is supposed to improve on.',
        '  return block.map(function (inst, at) { return at; });',
        '}',
        '',
        'function legal(block, order) {',
        '  const nodes = dag(block);',
        '  const position = {};',
        '  let ok = true;',
        '',
        '  order.forEach(function (at, step) { position[at] = step; });',
        '  nodes.forEach(function (node) {',
        '    node.succs.forEach(function (next) {',
        '      if (position[node.at] >= position[next]) ok = false;',
        '    });',
        '  });',
        '  return ok;',
        '}',
        '',
        'function lab() {',
        '  return { dag: dag, heights: heights, schedule: schedule, legal: legal };',
        '}'
      ].join('\n'),
      solution: [
        'function dag(block) {',
        '  const nodes = block.map(function (inst, at) {',
        '    return { at: at, preds: [], succs: [], latency: inst.latency || 1 };',
        '  });',
        '  const producer = {};',
        '',
        '  block.forEach(function (inst, at) {',
        '    (inst.reads || []).forEach(function (name) {',
        '      if (producer[name] === undefined) return;',
        '      nodes[producer[name]].succs.push(at);',
        '      nodes[at].preds.push(producer[name]);',
        '    });',
        '    if (inst.dest !== undefined) producer[inst.dest] = at;',
        '  });',
        '  return nodes;',
        '}',
        '',
        'function heights(nodes) {',
        '  const out = nodes.map(function () { return 0; });',
        '',
        '  for (let at = nodes.length - 1; at >= 0; at -= 1) {',
        '    out[at] = nodes[at].latency + nodes[at].succs.reduce(function (most, next) {',
        '      return Math.max(most, out[next]);',
        '    }, 0);',
        '  }',
        '  return out;',
        '}',
        '',
        'function readyNow(nodes, done) {',
        '  return nodes.filter(function (node) {',
        '    if (done.indexOf(node.at) !== -1) return false;',
        '    return node.preds.every(function (pred) { return done.indexOf(pred) !== -1; });',
        '  });',
        '}',
        '',
        'function schedule(block) {',
        '  const nodes = dag(block);',
        '  const height = heights(nodes);',
        '  const order = [];',
        '',
        '  while (order.length < nodes.length) {',
        '    const ready = readyNow(nodes, order);',
        '',
        '    if (!ready.length) break;',
        '    const pick = ready.reduce(function (best, node) {',
        '      if (height[node.at] !== height[best.at]) {',
        '        return height[node.at] > height[best.at] ? node : best;',
        '      }',
        '      return node.at < best.at ? node : best;',
        '    });',
        '',
        '    order.push(pick.at);',
        '  }',
        '  return order;',
        '}',
        '',
        'function legal(block, order) {',
        '  const nodes = dag(block);',
        '  const position = {};',
        '  let ok = true;',
        '',
        '  order.forEach(function (at, step) { position[at] = step; });',
        '  nodes.forEach(function (node) {',
        '    node.succs.forEach(function (next) {',
        '      if (position[node.at] >= position[next]) ok = false;',
        '    });',
        '  });',
        '  return ok;',
        '}',
        '',
        'function lab() {',
        '  return { dag: dag, heights: heights, schedule: schedule, legal: legal };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the instruction with the longest path to the end goes first',
          assert: function (lab, api) {
            const parts = lab();
            const block = [
              { id: 'cheap', dest: 'c', latency: 1 },
              { id: 'load', dest: 'l', latency: 8 },
              { id: 'use', reads: ['l'], dest: 'u', latency: 1 },
              { id: 'other', reads: ['c'], dest: 'o', latency: 1 }
            ];
            const order = parts.schedule(block);

            api.assert.equal(order[0], 1,
              'the load is on the critical path, so it issues first, got index ' + order[0]);
            api.assert.ok(parts.legal(block, order), 'and the order is legal');
          }
        },
        {
          name: 'a legal order never places a consumer before its producer',
          assert: function (lab, api) {
            const parts = lab();
            const block = [
              { id: 'a', dest: 'x', latency: 2 },
              { id: 'b', reads: ['x'], dest: 'y', latency: 1 },
              { id: 'c', reads: ['y'], latency: 1 }
            ];

            api.assert.ok(parts.legal(block, [0, 1, 2]), 'source order respects the chain');
            api.assert.ok(!parts.legal(block, [1, 0, 2]),
              'swapping a producer and its consumer must be rejected');
            api.assert.ok(parts.legal(block, parts.schedule(block)),
              'and the schedule produced is legal');
          }
        },
        {
          name: 'the height of a node counts its own latency',
          assert: function (lab, api) {
            const parts = lab();
            const block = [
              { id: 'a', dest: 'x', latency: 4 },
              { id: 'b', reads: ['x'], latency: 3 }
            ];
            const height = parts.heights(parts.dag(block));

            api.assert.equal(height[1], 3, 'the last instruction is its own latency');
            api.assert.equal(height[0], 7, 'and its producer is 4 plus the 3 behind it');
          }
        }
      ]
    }],

    'targeting-webassembly': [{
      id: 'stackifier',
      title: 'Turn a graph into structure, and count the branch depths right',
      prompt: 'A graph is { entry, blocks, succs, preds, backEdges } where `backEdges` is a ' +
        'list of { from, to }. Write classify(graph) returning, per block, one of "loop" (it ' +
        'is the target of a back edge), "block" (it has more than one predecessor and is not a ' +
        'loop header), or "inline". Write depth(context, label) returning the position of the ' +
        'label in `context`, counting from the innermost at 0, or -1 when it is not there — ' +
        'and note that an `if` occupies a position even though it has no label, so an entry ' +
        'of { kind: "if" } must be counted. The starter skips the `if` entries, which produces ' +
        'a branch that goes to the wrong enclosing construct.',
      entry: 'lab',
      starter: [
        'function classify(graph) {',
        '  const headers = {};',
        '  const out = {};',
        '',
        '  graph.backEdges.forEach(function (edge) { headers[edge.to] = true; });',
        '  graph.blocks.forEach(function (id) {',
        '    if (headers[id]) { out[id] = "loop"; return; }',
        '    out[id] = (graph.preds[id] || []).length > 1 ? "block" : "inline";',
        '  });',
        '  return out;',
        '}',
        '',
        'function depth(context, label) {',
        '  // The `if` entries are skipped, so every branch out of an if-else',
        '  // lands one construct too far out.',
        '  const labelled = context.filter(function (entry) { return entry.label !== undefined; });',
        '',
        '  for (let at = 0; at < labelled.length; at += 1) {',
        '    if (labelled[at].label === label) return at;',
        '  }',
        '  return -1;',
        '}',
        '',
        'function lab() {',
        '  return { classify: classify, depth: depth };',
        '}'
      ].join('\n'),
      solution: [
        'function classify(graph) {',
        '  const headers = {};',
        '  const out = {};',
        '',
        '  graph.backEdges.forEach(function (edge) { headers[edge.to] = true; });',
        '  graph.blocks.forEach(function (id) {',
        '    if (headers[id]) { out[id] = "loop"; return; }',
        '    out[id] = (graph.preds[id] || []).length > 1 ? "block" : "inline";',
        '  });',
        '  return out;',
        '}',
        '',
        'function depth(context, label) {',
        '  for (let at = 0; at < context.length; at += 1) {',
        '    if (context[at].label === label) return at;',
        '  }',
        '  return -1;',
        '}',
        '',
        'function lab() {',
        '  return { classify: classify, depth: depth };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a back-edge target is a loop even when it is also a merge point',
          assert: function (lab, api) {
            const parts = lab();
            const graph = {
              entry: 'b0',
              blocks: ['b0', 'b1', 'b2', 'b3'],
              preds: { b0: [], b1: ['b0', 'b2'], b2: ['b1'], b3: ['b1'] },
              succs: { b0: ['b1'], b1: ['b2', 'b3'], b2: ['b1'], b3: [] },
              backEdges: [{ from: 'b2', to: 'b1' }]
            };
            const out = parts.classify(graph);

            api.assert.equal(out.b1, 'loop', 'two predecessors and a back edge is a loop');
            api.assert.equal(out.b2, 'inline', 'one predecessor needs no label');
            api.assert.equal(out.b3, 'inline', 'and neither does the exit');
          }
        },
        {
          name: 'an if counts towards the branch depth',
          assert: function (lab, api) {
            const parts = lab();
            const context = [
              { kind: 'if' },
              { kind: 'block', label: 'm' },
              { kind: 'loop', label: 'L' }
            ];

            api.assert.equal(parts.depth(context, 'm'), 1,
              'the block is one construct out through the if');
            api.assert.equal(parts.depth(context, 'L'), 2, 'and the loop is two');
            api.assert.equal(parts.depth(context, 'nope'), -1, 'an absent label is not there');
          }
        },
        {
          name: 'a merge point with several predecessors becomes a block',
          assert: function (lab, api) {
            const parts = lab();
            const graph = {
              entry: 'b0',
              blocks: ['b0', 'b1', 'b2', 'b3'],
              preds: { b0: [], b1: ['b0'], b2: ['b0'], b3: ['b1', 'b2'] },
              succs: { b0: ['b1', 'b2'], b1: ['b3'], b2: ['b3'], b3: [] },
              backEdges: []
            };
            const out = parts.classify(graph);

            api.assert.equal(out.b3, 'block', 'the join needs a label to branch to');
            api.assert.equal(out.b1, 'inline');
            api.assert.equal(out.b2, 'inline');
          }
        }
      ]
    }],

    'jit-compilation': [{
      id: 'guards-and-deopt',
      title: 'Check the guard before the instruction touches anything',
      prompt: 'A frame is { stack: [], pc }. A compiled instruction is a function taking the ' +
        'frame. Write fastAdd(frame) which adds the top two stack values as numbers: read them ' +
        'WITHOUT popping, throw { deopt: true, pc: frame.pc } if either is not a number, and ' +
        'only then pop both and push the sum. Write run(frame, ops, slowAdd) which executes ' +
        'ops[frame.pc] repeatedly, advancing the counter — and on a deopt, rewinds the counter ' +
        'to the instruction that threw, calls slowAdd(frame) for it, advances past it, and ' +
        'carries on, counting deopts. Return { deopts, stack }. The starter pops first and ' +
        'checks second, so a deopt resumes an instruction whose operands are gone.',
      entry: 'lab',
      starter: [
        'function fastAdd(frame) {',
        '  // The operands are consumed before the guard runs, so a deopt resumes',
        '  // an instruction that has already half-happened.',
        '  const right = frame.stack.pop();',
        '  const left = frame.stack.pop();',
        '',
        '  if (typeof left !== "number" || typeof right !== "number") {',
        '    throw { deopt: true, pc: frame.pc };',
        '  }',
        '  frame.stack.push(left + right);',
        '}',
        '',
        'function run(frame, ops, slowAdd) {',
        '  let deopts = 0;',
        '  let guard = 0;',
        '',
        '  while (frame.pc < ops.length && guard < 1000) {',
        '    const at = frame.pc;',
        '',
        '    guard += 1;',
        '    frame.pc += 1;',
        '    try {',
        '      ops[at](frame);',
        '    } catch (problem) {',
        '      if (!problem || !problem.deopt) throw problem;',
        '      deopts += 1;',
        '      frame.pc = at;',
        '      slowAdd(frame);',
        '      frame.pc = at + 1;',
        '    }',
        '  }',
        '  return { deopts: deopts, stack: frame.stack };',
        '}',
        '',
        'function lab() {',
        '  return { fastAdd: fastAdd, run: run };',
        '}'
      ].join('\n'),
      solution: [
        'function fastAdd(frame) {',
        '  const top = frame.stack.length;',
        '  const left = frame.stack[top - 2];',
        '  const right = frame.stack[top - 1];',
        '',
        '  if (typeof left !== "number" || typeof right !== "number") {',
        '    throw { deopt: true, pc: frame.pc };',
        '  }',
        '  frame.stack.length = top - 2;',
        '  frame.stack.push(left + right);',
        '}',
        '',
        'function run(frame, ops, slowAdd) {',
        '  let deopts = 0;',
        '  let guard = 0;',
        '',
        '  while (frame.pc < ops.length && guard < 1000) {',
        '    const at = frame.pc;',
        '',
        '    guard += 1;',
        '    frame.pc += 1;',
        '    try {',
        '      ops[at](frame);',
        '    } catch (problem) {',
        '      if (!problem || !problem.deopt) throw problem;',
        '      deopts += 1;',
        '      frame.pc = at;',
        '      slowAdd(frame);',
        '      frame.pc = at + 1;',
        '    }',
        '  }',
        '  return { deopts: deopts, stack: frame.stack };',
        '}',
        '',
        'function lab() {',
        '  return { fastAdd: fastAdd, run: run };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a failed guard leaves the frame exactly as it found it',
          assert: function (lab, api) {
            const parts = lab();
            const frame = { stack: ['a', 'b'], pc: 0 };

            try {
              parts.fastAdd(frame);
              api.assert.ok(false, 'the guard should have refused two strings');
            } catch (problem) {
              api.assert.ok(problem && problem.deopt, 'it deoptimises rather than failing');
            }
            api.assert.deepEqual(frame.stack, ['a', 'b'],
              'nothing was consumed, so the interpreter can resume the instruction');
          }
        },
        {
          name: 'the deopt path computes what the fast path would have',
          assert: function (lab, api) {
            const parts = lab();
            const fast = parts.fastAdd;
            const slow = function (frame) {
              const right = frame.stack.pop();
              const left = frame.stack.pop();

              frame.stack.push(String(left) + String(right));
            };
            const frame = { stack: ['x', 'y'], pc: 0 };
            const out = parts.run(frame, [fast], slow);

            api.assert.equal(out.deopts, 1, 'the guard fired once');
            api.assert.deepEqual(out.stack, ['xy'],
              'and the interpreter concatenated the two strings it still had');
          }
        },
        {
          name: 'a guard that holds costs nothing',
          assert: function (lab, api) {
            const parts = lab();
            const fast = parts.fastAdd;
            const slow = function () {
              throw new Error('the slow path should not have been reached');
            };
            const frame = { stack: [2, 3, 4], pc: 0 };
            const out = parts.run(frame, [fast, fast], slow);

            api.assert.equal(out.deopts, 0, 'both guards held');
            api.assert.deepEqual(out.stack, [9], '2 + 3 + 4 through the fast path');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

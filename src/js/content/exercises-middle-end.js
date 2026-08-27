/**
 * Graded exercises for the IR, control-flow graphs and dominators (M29.1-M29.3).
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
    'designing-an-ir': [{
      id: 'verify-blocks',
      title: 'Write the verifier, and make it name the invariant',
      prompt: 'A function is { blocks: [{ id, instructions: [{ op, target, targets, dest, ' +
        'reads }] }] }. An instruction is a terminator when its op is "jump", "branch" or ' +
        '"return". Write terminators(fn) returning one row per block as { block, count } in ' +
        'block order, where count is how many terminators the block contains ANYWHERE — a ' +
        'terminator in the middle is as wrong as none at all. Write targets(fn) returning the ' +
        'ids named by any jump or branch that are not blocks of this function, without ' +
        'duplicates and in the order first seen. Write verify(fn) returning the list of ' +
        'violations as { invariant, block } — invariant "terminator" for any block whose count ' +
        'is not exactly one, and "target" for the first block naming each missing target. The ' +
        'starter checks only the LAST instruction, so a block with two terminators or with a ' +
        'jump in the middle passes.',
      entry: 'lab',
      starter: [
        'const TERMINATORS = ["jump", "branch", "return"];',
        '',
        'function isTerminator(instruction) {',
        '  return TERMINATORS.indexOf(instruction.op) !== -1;',
        '}',
        '',
        'function terminators(fn) {',
        '  return fn.blocks.map(function (block) {',
        '    const last = block.instructions[block.instructions.length - 1];',
        '',
        '    // Only the last one is examined, so a terminator in the middle is invisible.',
        '    return { block: block.id, count: last && isTerminator(last) ? 1 : 0 };',
        '  });',
        '}',
        '',
        'function namedTargets(instruction) {',
        '  if (instruction.targets) return instruction.targets;',
        '  if (instruction.target) return [instruction.target];',
        '  return [];',
        '}',
        '',
        'function targets(fn) {',
        '  const known = fn.blocks.map(function (block) { return block.id; });',
        '  const missing = [];',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    block.instructions.forEach(function (instruction) {',
        '      namedTargets(instruction).forEach(function (id) {',
        '        if (known.indexOf(id) === -1 && missing.indexOf(id) === -1) missing.push(id);',
        '      });',
        '    });',
        '  });',
        '  return missing;',
        '}',
        '',
        'function verify(fn) {',
        '  const out = [];',
        '',
        '  terminators(fn).forEach(function (row) {',
        '    if (row.count !== 1) out.push({ invariant: "terminator", block: row.block });',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { terminators: terminators, targets: targets, verify: verify };',
        '}'
      ].join('\n'),
      solution: [
        'const TERMINATORS = ["jump", "branch", "return"];',
        '',
        'function isTerminator(instruction) {',
        '  return TERMINATORS.indexOf(instruction.op) !== -1;',
        '}',
        '',
        'function terminators(fn) {',
        '  return fn.blocks.map(function (block) {',
        '    return {',
        '      block: block.id,',
        '      count: block.instructions.filter(isTerminator).length',
        '    };',
        '  });',
        '}',
        '',
        'function namedTargets(instruction) {',
        '  if (instruction.targets) return instruction.targets;',
        '  if (instruction.target) return [instruction.target];',
        '  return [];',
        '}',
        '',
        'function targets(fn) {',
        '  const known = fn.blocks.map(function (block) { return block.id; });',
        '  const missing = [];',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    block.instructions.forEach(function (instruction) {',
        '      namedTargets(instruction).forEach(function (id) {',
        '        if (known.indexOf(id) === -1 && missing.indexOf(id) === -1) missing.push(id);',
        '      });',
        '    });',
        '  });',
        '  return missing;',
        '}',
        '',
        'function missingFrom(fn) {',
        '  const known = fn.blocks.map(function (block) { return block.id; });',
        '  const seen = [];',
        '  const out = [];',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    block.instructions.forEach(function (instruction) {',
        '      namedTargets(instruction).forEach(function (id) {',
        '        if (known.indexOf(id) !== -1 || seen.indexOf(id) !== -1) return;',
        '        seen.push(id);',
        '        out.push({ invariant: "target", block: block.id });',
        '      });',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function verify(fn) {',
        '  const out = [];',
        '',
        '  terminators(fn).forEach(function (row) {',
        '    if (row.count !== 1) out.push({ invariant: "terminator", block: row.block });',
        '  });',
        '  return out.concat(missingFrom(fn));',
        '}',
        '',
        'function lab() {',
        '  return { terminators: terminators, targets: targets, verify: verify };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a terminator in the middle of a block is a violation',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { blocks: [
              { id: 'b0', instructions: [
                { op: 'const', dest: '%0' },
                { op: 'jump', target: 'b1' },
                { op: 'const', dest: '%1' },
                { op: 'jump', target: 'b1' }
              ] },
              { id: 'b1', instructions: [{ op: 'return', reads: ['%0'] }] }
            ] };
            const rows = parts.terminators(fn);

            api.assert.equal(rows[0].count, 2,
              'b0 contains two terminators — counting only the last one reports one');
            api.assert.equal(rows[1].count, 1, 'b1 contains exactly one');
            api.assert.equal(parts.verify(fn).length, 1, 'exactly one violation');
            api.assert.equal(parts.verify(fn)[0].invariant, 'terminator',
              'and it names the invariant it broke');
          }
        },
        {
          name: 'a block with no terminator at all is also a violation',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { blocks: [
              { id: 'b0', instructions: [{ op: 'const', dest: '%0' }] },
              { id: 'b1', instructions: [{ op: 'return', reads: ['%0'] }] }
            ] };

            api.assert.equal(parts.terminators(fn)[0].count, 0, 'b0 falls off its end');
            api.assert.deepEqual(parts.verify(fn), [{ invariant: 'terminator', block: 'b0' }],
              'one violation, naming b0');
          }
        },
        {
          name: 'a jump to a block that does not exist is caught, once per target',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { blocks: [
              { id: 'b0', instructions: [{ op: 'branch', targets: ['b1', 'b9'] }] },
              { id: 'b1', instructions: [{ op: 'jump', target: 'b9' }] }
            ] };

            api.assert.deepEqual(parts.targets(fn), ['b9'], 'b9 is named and does not exist');
            api.assert.equal(parts.verify(fn).length, 1,
              'one violation, not one per mention — b9 is reported at the block that named it first');
            api.assert.equal(parts.verify(fn)[0].invariant, 'target', 'the target invariant');
            api.assert.equal(parts.verify(fn)[0].block, 'b0', 'reported where it was first seen');
          }
        }
      ]
    }],

    'control-flow-graphs': [{
      id: 'back-edges-and-loops',
      title: 'Find the back edges by dominance, and the loop they bound',
      prompt: 'A graph is { entry, blocks: { id: [successorId] } }. You are given dominators(' +
        'graph) returning, for each block, the set of blocks that dominate it — use it, do not ' +
        'rewrite it. Write backEdges(graph) returning the edges { from, to } whose TARGET ' +
        'dominates their SOURCE, in the order the sources are listed. Write naturalLoop(graph, ' +
        'edge) returning the sorted ids of the loop\'s blocks: the header, the latch, and ' +
        'every block that can reach the latch without passing through the header. Write ' +
        'critical(graph) returning the edges { from, to } whose source has more than one ' +
        'successor and whose target has more than one predecessor. The starter calls an edge a ' +
        'back edge when its target sorts earlier than its source, which is not the same thing ' +
        'and is wrong on any jump into a region.',
      entry: 'lab',
      starter: [
        'function dominators(graph) {',
        '  const ids = Object.keys(graph.blocks);',
        '  const sets = {};',
        '',
        '  ids.forEach(function (id) { sets[id] = id === graph.entry ? [id] : ids.slice(); });',
        '',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    ids.forEach(function (id) {',
        '      if (id === graph.entry) return;',
        '',
        '      const preds = ids.filter(function (other) {',
        '        return graph.blocks[other].indexOf(id) !== -1;',
        '      });',
        '',
        '      if (preds.length === 0) return;',
        '',
        '      let next = sets[preds[0]].slice();',
        '',
        '      preds.slice(1).forEach(function (pred) {',
        '        next = next.filter(function (b) { return sets[pred].indexOf(b) !== -1; });',
        '      });',
        '      if (next.indexOf(id) === -1) next.push(id);',
        '      next.sort();',
        '      if (next.join(",") !== sets[id].join(",")) { sets[id] = next; changed = true; }',
        '    });',
        '  }',
        '  return sets;',
        '}',
        '',
        'function edgesOf(graph) {',
        '  const out = [];',
        '',
        '  Object.keys(graph.blocks).forEach(function (from) {',
        '    graph.blocks[from].forEach(function (to) { out.push({ from: from, to: to }); });',
        '  });',
        '  return out;',
        '}',
        '',
        'function backEdges(graph) {',
        '  // Ordering is not dominance: this calls any edge pointing "backwards" a back edge.',
        '  return edgesOf(graph).filter(function (edge) { return edge.to <= edge.from; });',
        '}',
        '',
        'function naturalLoop(graph, edge) {',
        '  const body = [edge.to];',
        '  const stack = [edge.from];',
        '',
        '  while (stack.length) {',
        '    const id = stack.pop();',
        '',
        '    if (body.indexOf(id) !== -1) continue;',
        '    body.push(id);',
        '    Object.keys(graph.blocks).forEach(function (from) {',
        '      if (graph.blocks[from].indexOf(id) !== -1) stack.push(from);',
        '    });',
        '  }',
        '  return body.sort();',
        '}',
        '',
        'function critical(graph) {',
        '  return edgesOf(graph).filter(function (edge) {',
        '    const preds = Object.keys(graph.blocks).filter(function (from) {',
        '      return graph.blocks[from].indexOf(edge.to) !== -1;',
        '    });',
        '',
        '    return graph.blocks[edge.from].length > 1 && preds.length > 1;',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { dominators: dominators, backEdges: backEdges, naturalLoop: naturalLoop,',
        '    critical: critical };',
        '}'
      ].join('\n'),
      solution: [
        'function dominators(graph) {',
        '  const ids = Object.keys(graph.blocks);',
        '  const sets = {};',
        '',
        '  ids.forEach(function (id) { sets[id] = id === graph.entry ? [id] : ids.slice(); });',
        '',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    ids.forEach(function (id) {',
        '      if (id === graph.entry) return;',
        '',
        '      const preds = ids.filter(function (other) {',
        '        return graph.blocks[other].indexOf(id) !== -1;',
        '      });',
        '',
        '      if (preds.length === 0) return;',
        '',
        '      let next = sets[preds[0]].slice();',
        '',
        '      preds.slice(1).forEach(function (pred) {',
        '        next = next.filter(function (b) { return sets[pred].indexOf(b) !== -1; });',
        '      });',
        '      if (next.indexOf(id) === -1) next.push(id);',
        '      next.sort();',
        '      if (next.join(",") !== sets[id].join(",")) { sets[id] = next; changed = true; }',
        '    });',
        '  }',
        '  return sets;',
        '}',
        '',
        'function edgesOf(graph) {',
        '  const out = [];',
        '',
        '  Object.keys(graph.blocks).forEach(function (from) {',
        '    graph.blocks[from].forEach(function (to) { out.push({ from: from, to: to }); });',
        '  });',
        '  return out;',
        '}',
        '',
        'function backEdges(graph) {',
        '  const dom = dominators(graph);',
        '',
        '  return edgesOf(graph).filter(function (edge) {',
        '    return dom[edge.from].indexOf(edge.to) !== -1;',
        '  });',
        '}',
        '',
        'function naturalLoop(graph, edge) {',
        '  const body = [edge.to];',
        '  const stack = [edge.from];',
        '',
        '  while (stack.length) {',
        '    const id = stack.pop();',
        '',
        '    if (body.indexOf(id) !== -1) continue;',
        '    body.push(id);',
        '    Object.keys(graph.blocks).forEach(function (from) {',
        '      if (graph.blocks[from].indexOf(id) !== -1) stack.push(from);',
        '    });',
        '  }',
        '  return body.sort();',
        '}',
        '',
        'function critical(graph) {',
        '  return edgesOf(graph).filter(function (edge) {',
        '    const preds = Object.keys(graph.blocks).filter(function (from) {',
        '      return graph.blocks[from].indexOf(edge.to) !== -1;',
        '    });',
        '',
        '    return graph.blocks[edge.from].length > 1 && preds.length > 1;',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { dominators: dominators, backEdges: backEdges, naturalLoop: naturalLoop,',
        '    critical: critical };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a jump backwards into a region is not a back edge',
          assert: function (lab, api) {
            const parts = lab();
            // b3 jumps to b1, but b1 does not dominate b3: b2 reaches b3 without it.
            const graph = { entry: 'b0', blocks: {
              b0: ['b1', 'b2'], b1: ['b3'], b2: ['b3'], b3: []
            } };

            api.assert.deepEqual(parts.backEdges(graph), [],
              'no edge here has a target that dominates its source');

            const withJump = { entry: 'b0', blocks: {
              b0: ['b1', 'b2'], b1: ['b3'], b2: ['b1'], b3: []
            } };

            api.assert.deepEqual(parts.backEdges(withJump), [],
              'b2 to b1 points at an earlier block and is still not a back edge — b1 does not dominate b2');
          }
        },
        {
          name: 'a real loop is found by dominance, and its body is the natural loop',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { entry: 'b0', blocks: {
              b0: ['b1'], b1: ['b2', 'b4'], b2: ['b3'], b3: ['b1'], b4: []
            } };
            const back = parts.backEdges(graph);

            api.assert.equal(back.length, 1, 'one back edge');
            api.assert.equal(back[0].from, 'b3', 'from the latch');
            api.assert.equal(back[0].to, 'b1', 'to the header, which dominates it');
            api.assert.deepEqual(parts.naturalLoop(graph, back[0]), ['b1', 'b2', 'b3'],
              'the header and everything reaching the latch without leaving through it');
            api.assert.equal(parts.naturalLoop(graph, back[0]).indexOf('b4'), -1,
              'the exit is outside the loop');
          }
        },
        {
          name: 'a critical edge needs a split source and a joined target',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { entry: 'b0', blocks: {
              b0: ['b1', 'b2'], b1: ['b2'], b2: []
            } };
            const found = parts.critical(graph);

            api.assert.equal(found.length, 1, 'exactly one critical edge');
            api.assert.equal(found[0].from, 'b0', 'from the block with two successors');
            api.assert.equal(found[0].to, 'b2', 'to the block with two predecessors');

            const chain = { entry: 'b0', blocks: { b0: ['b1'], b1: ['b2'], b2: [] } };

            api.assert.deepEqual(parts.critical(chain), [],
              'straight-line code has no critical edges');
          }
        }
      ]
    }],

    'dominators': [{
      id: 'frontier-fixpoint',
      title: 'Run the iteration to a fixpoint, and derive the frontier',
      prompt: 'A graph is { entry, blocks: { id: [successorId] } }. Write rounds(graph) ' +
        'returning one row per round as { round, changed }, iterating the dominator sets in ' +
        'the given block order until a round changes nothing — and INCLUDING that final round, ' +
        'because a fixpoint is proved by a round that changes nothing. Write dominators(graph) ' +
        'returning the final sets, each sorted. Write idom(graph) returning each block\'s ' +
        'immediate dominator: the one of its strict dominators that is dominated by all the ' +
        'others; the entry\'s is null. Write frontier(graph) returning, for each block, the ' +
        'sorted ids of the blocks it does not strictly dominate but that have a predecessor it ' +
        'does dominate. The starter stops as soon as a round changes nothing and does not ' +
        'count that round, so it reports one round for a graph that needed two passes to ' +
        'settle.',
      entry: 'lab',
      starter: [
        'function predecessors(graph, id) {',
        '  return Object.keys(graph.blocks).filter(function (from) {',
        '    return graph.blocks[from].indexOf(id) !== -1;',
        '  });',
        '}',
        '',
        'function step(graph, sets) {',
        '  let changed = 0;',
        '',
        '  Object.keys(graph.blocks).forEach(function (id) {',
        '    if (id === graph.entry) return;',
        '',
        '    const preds = predecessors(graph, id);',
        '',
        '    if (preds.length === 0) return;',
        '',
        '    let next = sets[preds[0]].slice();',
        '',
        '    preds.slice(1).forEach(function (pred) {',
        '      next = next.filter(function (b) { return sets[pred].indexOf(b) !== -1; });',
        '    });',
        '    if (next.indexOf(id) === -1) next.push(id);',
        '    next.sort();',
        '    if (next.join(",") !== sets[id].join(",")) { sets[id] = next; changed += 1; }',
        '  });',
        '  return changed;',
        '}',
        '',
        'function initial(graph) {',
        '  const ids = Object.keys(graph.blocks);',
        '  const sets = {};',
        '',
        '  ids.forEach(function (id) { sets[id] = id === graph.entry ? [id] : ids.slice(); });',
        '  return sets;',
        '}',
        '',
        'function rounds(graph) {',
        '  const sets = initial(graph);',
        '  const out = [];',
        '  let changed = step(graph, sets);',
        '',
        '  // Stops the moment a round is productive-free, and never records that round.',
        '  while (changed > 0) {',
        '    out.push({ round: out.length + 1, changed: changed });',
        '    changed = step(graph, sets);',
        '  }',
        '  return out;',
        '}',
        '',
        'function dominators(graph) {',
        '  const sets = initial(graph);',
        '',
        '  while (step(graph, sets) > 0) { /* iterate */ }',
        '  return sets;',
        '}',
        '',
        'function idom(graph) {',
        '  const dom = dominators(graph);',
        '  const out = {};',
        '',
        '  Object.keys(graph.blocks).forEach(function (id) {',
        '    const strict = dom[id].filter(function (d) { return d !== id; });',
        '',
        '    out[id] = strict.filter(function (candidate) {',
        '      return strict.every(function (other) {',
        '        return other === candidate || dom[candidate].indexOf(other) !== -1;',
        '      });',
        '    })[0] || null;',
        '  });',
        '  return out;',
        '}',
        '',
        'function frontier(graph) {',
        '  const dom = dominators(graph);',
        '  const out = {};',
        '',
        '  Object.keys(graph.blocks).forEach(function (id) {',
        '    out[id] = Object.keys(graph.blocks).filter(function (target) {',
        '      const strictly = target !== id && dom[target].indexOf(id) !== -1;',
        '',
        '      if (strictly) return false;',
        '      return predecessors(graph, target).some(function (pred) {',
        '        return dom[pred].indexOf(id) !== -1;',
        '      });',
        '    }).sort();',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { rounds: rounds, dominators: dominators, idom: idom, frontier: frontier };',
        '}'
      ].join('\n'),
      solution: [
        'function predecessors(graph, id) {',
        '  return Object.keys(graph.blocks).filter(function (from) {',
        '    return graph.blocks[from].indexOf(id) !== -1;',
        '  });',
        '}',
        '',
        'function step(graph, sets) {',
        '  let changed = 0;',
        '',
        '  Object.keys(graph.blocks).forEach(function (id) {',
        '    if (id === graph.entry) return;',
        '',
        '    const preds = predecessors(graph, id);',
        '',
        '    if (preds.length === 0) return;',
        '',
        '    let next = sets[preds[0]].slice();',
        '',
        '    preds.slice(1).forEach(function (pred) {',
        '      next = next.filter(function (b) { return sets[pred].indexOf(b) !== -1; });',
        '    });',
        '    if (next.indexOf(id) === -1) next.push(id);',
        '    next.sort();',
        '    if (next.join(",") !== sets[id].join(",")) { sets[id] = next; changed += 1; }',
        '  });',
        '  return changed;',
        '}',
        '',
        'function initial(graph) {',
        '  const ids = Object.keys(graph.blocks);',
        '  const sets = {};',
        '',
        '  ids.forEach(function (id) { sets[id] = id === graph.entry ? [id] : ids.slice(); });',
        '  return sets;',
        '}',
        '',
        'function rounds(graph) {',
        '  const sets = initial(graph);',
        '  const out = [];',
        '  let changed = -1;',
        '',
        '  while (changed !== 0) {',
        '    changed = step(graph, sets);',
        '    out.push({ round: out.length + 1, changed: changed });',
        '  }',
        '  return out;',
        '}',
        '',
        'function dominators(graph) {',
        '  const sets = initial(graph);',
        '',
        '  while (step(graph, sets) > 0) { /* iterate */ }',
        '  return sets;',
        '}',
        '',
        'function idom(graph) {',
        '  const dom = dominators(graph);',
        '  const out = {};',
        '',
        '  Object.keys(graph.blocks).forEach(function (id) {',
        '    const strict = dom[id].filter(function (d) { return d !== id; });',
        '',
        '    out[id] = strict.filter(function (candidate) {',
        '      return strict.every(function (other) {',
        '        return other === candidate || dom[candidate].indexOf(other) !== -1;',
        '      });',
        '    })[0] || null;',
        '  });',
        '  return out;',
        '}',
        '',
        'function frontier(graph) {',
        '  const dom = dominators(graph);',
        '  const out = {};',
        '',
        '  Object.keys(graph.blocks).forEach(function (id) {',
        '    out[id] = Object.keys(graph.blocks).filter(function (target) {',
        '      const strictly = target !== id && dom[target].indexOf(id) !== -1;',
        '',
        '      if (strictly) return false;',
        '      return predecessors(graph, target).some(function (pred) {',
        '        return dom[pred].indexOf(id) !== -1;',
        '      });',
        '    }).sort();',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { rounds: rounds, dominators: dominators, idom: idom, frontier: frontier };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the fixpoint is proved by a round that changes nothing, and it is reported',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { entry: 'b0', blocks: {
              b0: ['b1'], b1: ['b2', 'b3'], b2: ['b4'], b3: ['b4'], b4: []
            } };
            const table = parts.rounds(graph);
            const last = table[table.length - 1];

            api.assert.atLeast(table.length, 2, 'a productive round and a confirming one');
            api.assert.equal(last.changed, 0,
              'the final round changed nothing, which is what proves the fixpoint');
            api.assert.atLeast(table[0].changed, 1, 'the first round did the work');
            api.assert.equal(table[table.length - 2].changed > 0, true,
              'the round before the last was still productive');
          }
        },
        {
          name: 'the join block is dominated by the branch, not by either arm',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { entry: 'b0', blocks: {
              b0: ['b1'], b1: ['b2', 'b3'], b2: ['b4'], b3: ['b4'], b4: []
            } };
            const dom = parts.dominators(graph);

            api.assert.deepEqual(dom.b4, ['b0', 'b1', 'b4'],
              'neither arm dominates the join');
            api.assert.equal(parts.idom(graph).b4, 'b1', 'its immediate dominator is the branch');
            api.assert.equal(parts.idom(graph).b0, null, 'the entry has none');
          }
        },
        {
          name: 'the frontier of each arm is the join, which is where a phi goes',
          assert: function (lab, api) {
            const parts = lab();
            const graph = { entry: 'b0', blocks: {
              b0: ['b1'], b1: ['b2', 'b3'], b2: ['b4'], b3: ['b4'], b4: []
            } };
            const df = parts.frontier(graph);

            api.assert.deepEqual(df.b2, ['b4'], 'the arm stops being the only possibility at b4');
            api.assert.deepEqual(df.b3, ['b4'], 'and so does the other one');
            api.assert.deepEqual(df.b1, [], 'the branch dominates everything downstream of it');
            api.assert.deepEqual(df.b4, [], 'and so does the join');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

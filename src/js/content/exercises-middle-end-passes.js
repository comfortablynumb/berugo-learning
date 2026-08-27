/**
 * Graded exercises for SSA, dataflow and the scalar passes (M29.4-M29.6).
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
    'ssa-form': [{
      id: 'place-and-prune',
      title: 'Place phis at the iterated frontier, then prune the ones nothing reads',
      prompt: 'A function is { blocks: [id], frontier: { id: [id] }, writes: { slot: [id] }, ' +
        'reads: { slot: [id] } }. Write place(fn, slot) returning the sorted block ids where a ' +
        'phi for that slot belongs: the ITERATED dominance frontier of the blocks that write ' +
        'it — a phi is itself a definition, so its own block\'s frontier needs phis too, to a ' +
        'fixpoint. Write placeAll(fn) returning { slot: [id] } for every slot in writes. Write ' +
        'prune(fn, placement) returning the same shape with any phi removed whose slot has no ' +
        'read in that block and no phi for that slot in a block the slot\'s value can still ' +
        'reach — approximate that as: keep a phi only if the slot is read somewhere, ' +
        'ANYWHERE. Write counts(fn) returning { placed, pruned, kept } summed over all slots. ' +
        'The starter takes the frontier of the writing blocks once and stops, which is minimal ' +
        'SSA missing every phi that another phi made necessary.',
      entry: 'lab',
      starter: [
        'function unionFrontier(fn, blocks) {',
        '  const out = [];',
        '',
        '  blocks.forEach(function (id) {',
        '    (fn.frontier[id] || []).forEach(function (target) {',
        '      if (out.indexOf(target) === -1) out.push(target);',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function place(fn, slot) {',
        '  // One sweep only: a phi that creates the need for another phi is missed.',
        '  return unionFrontier(fn, fn.writes[slot] || []).sort();',
        '}',
        '',
        'function placeAll(fn) {',
        '  const out = {};',
        '',
        '  Object.keys(fn.writes).forEach(function (slot) { out[slot] = place(fn, slot); });',
        '  return out;',
        '}',
        '',
        'function prune(fn, placement) {',
        '  const out = {};',
        '',
        '  Object.keys(placement).forEach(function (slot) {',
        '    const read = (fn.reads[slot] || []).length > 0;',
        '',
        '    out[slot] = read ? placement[slot].slice() : [];',
        '  });',
        '  return out;',
        '}',
        '',
        'function counts(fn) {',
        '  const placement = placeAll(fn);',
        '  const kept = prune(fn, placement);',
        '  let placed = 0;',
        '  let left = 0;',
        '',
        '  Object.keys(placement).forEach(function (slot) {',
        '    placed += placement[slot].length;',
        '    left += kept[slot].length;',
        '  });',
        '  return { placed: placed, pruned: placed - left, kept: left };',
        '}',
        '',
        'function lab() {',
        '  return { place: place, placeAll: placeAll, prune: prune, counts: counts };',
        '}'
      ].join('\n'),
      solution: [
        'function unionFrontier(fn, blocks) {',
        '  const out = [];',
        '',
        '  blocks.forEach(function (id) {',
        '    (fn.frontier[id] || []).forEach(function (target) {',
        '      if (out.indexOf(target) === -1) out.push(target);',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function place(fn, slot) {',
        '  const defs = (fn.writes[slot] || []).slice();',
        '  const phis = [];',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    unionFrontier(fn, defs).forEach(function (target) {',
        '      if (phis.indexOf(target) !== -1) return;',
        '      phis.push(target);',
        '      if (defs.indexOf(target) === -1) defs.push(target);',
        '      changed = true;',
        '    });',
        '  }',
        '  return phis.sort();',
        '}',
        '',
        'function placeAll(fn) {',
        '  const out = {};',
        '',
        '  Object.keys(fn.writes).forEach(function (slot) { out[slot] = place(fn, slot); });',
        '  return out;',
        '}',
        '',
        'function prune(fn, placement) {',
        '  const out = {};',
        '',
        '  Object.keys(placement).forEach(function (slot) {',
        '    const read = (fn.reads[slot] || []).length > 0;',
        '',
        '    out[slot] = read ? placement[slot].slice() : [];',
        '  });',
        '  return out;',
        '}',
        '',
        'function counts(fn) {',
        '  const placement = placeAll(fn);',
        '  const kept = prune(fn, placement);',
        '  let placed = 0;',
        '  let left = 0;',
        '',
        '  Object.keys(placement).forEach(function (slot) {',
        '    placed += placement[slot].length;',
        '    left += kept[slot].length;',
        '  });',
        '  return { placed: placed, pruned: placed - left, kept: left };',
        '}',
        '',
        'function lab() {',
        '  return { place: place, placeAll: placeAll, prune: prune, counts: counts };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a phi is a definition, so placement iterates to a fixpoint',
          assert: function (lab, api) {
            const parts = lab();
            // b2 is the frontier of b1; b4 is the frontier of b2. A single sweep finds b2 only.
            const fn = {
              blocks: ['b0', 'b1', 'b2', 'b3', 'b4'],
              frontier: { b0: [], b1: ['b2'], b2: ['b4'], b3: ['b4'], b4: [] },
              writes: { t: ['b1'] },
              reads: { t: ['b4'] }
            };

            api.assert.deepEqual(parts.place(fn, 't'), ['b2', 'b4'],
              'the phi in b2 is itself a definition, and its frontier needs one too');
          }
        },
        {
          name: 'a slot nothing reads keeps no phis at all',
          assert: function (lab, api) {
            const parts = lab();
            const fn = {
              blocks: ['b0', 'b1', 'b2'],
              frontier: { b0: [], b1: ['b2'], b2: [] },
              writes: { t: ['b1'], dead: ['b1'] },
              reads: { t: ['b2'] }
            };
            const placement = parts.placeAll(fn);
            const kept = parts.prune(fn, placement);

            api.assert.deepEqual(placement.dead, ['b2'], 'minimal SSA places it anyway');
            api.assert.deepEqual(kept.dead, [], 'pruned SSA does not keep it');
            api.assert.deepEqual(kept.t, ['b2'], 'the read slot keeps its phi');
          }
        },
        {
          name: 'the three counts are placed, pruned and kept',
          assert: function (lab, api) {
            const parts = lab();
            const fn = {
              blocks: ['b0', 'b1', 'b2', 'b3', 'b4'],
              frontier: { b0: [], b1: ['b2'], b2: ['b4'], b3: ['b4'], b4: [] },
              writes: { t: ['b1'], dead: ['b1'] },
              reads: { t: ['b4'] }
            };
            const row = parts.counts(fn);

            api.assert.equal(row.placed, 4, 'two slots at two blocks each, after iteration');
            api.assert.equal(row.pruned, 2, 'the unread slot loses both');
            api.assert.equal(row.kept, 2, 'and the read one keeps both');
          }
        }
      ]
    }],

    'dataflow-analysis': [{
      id: 'worklist-solver',
      title: 'One solver, four parameterisations, and the field that fails silently',
      prompt: 'A function is { blocks: [{ id, succ: [id], gen: [fact], kill: [fact] }] }. An ' +
        'analysis is { direction: "forward" | "backward", meet: "union" | "intersect" }. Write ' +
        'initialFor(analysis, universe) returning the starting set for every block: the empty ' +
        'list for a union analysis and a copy of the universe for an intersection one. Write ' +
        'solve(fn, analysis, universe) returning { sets: { id: { in, out } }, visits }, where ' +
        'each set is sorted, visits counts how many times a block\'s transfer function ran, ' +
        'and a block re-enters the worklist only when a neighbour it depends on changed. The ' +
        'transfer function is gen union (input minus kill), applied from OUT to IN for a ' +
        'backward analysis and from IN to OUT for a forward one; the boundary block starts at ' +
        'empty. Write universeOf(fn) returning every fact mentioned in any gen or kill, ' +
        'sorted. The starter initialises every analysis to the empty set, which makes an ' +
        'intersection analysis converge on the first visit and report a perfectly well-formed ' +
        'fixpoint of nothing.',
      entry: 'lab',
      starter: [
        'function sorted(list) {',
        '  return list.slice().sort();',
        '}',
        '',
        'function union(a, b) {',
        '  return sorted(a.concat(b.filter(function (x) { return a.indexOf(x) === -1; })));',
        '}',
        '',
        'function intersect(a, b) {',
        '  return sorted(a.filter(function (x) { return b.indexOf(x) !== -1; }));',
        '}',
        '',
        'function universeOf(fn) {',
        '  const out = [];',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    block.gen.concat(block.kill).forEach(function (fact) {',
        '      if (out.indexOf(fact) === -1) out.push(fact);',
        '    });',
        '  });',
        '  return sorted(out);',
        '}',
        '',
        'function initialFor(analysis, universe) {',
        '  // Always empty: correct for union, and silently fatal for intersection.',
        '  return [];',
        '}',
        '',
        'function transfer(block, input) {',
        '  return union(block.gen, input.filter(function (fact) {',
        '    return block.kill.indexOf(fact) === -1;',
        '  }));',
        '}',
        '',
        'function neighboursOf(fn, block, analysis) {',
        '  if (analysis.direction === "forward") {',
        '    return fn.blocks.filter(function (other) {',
        '      return other.succ.indexOf(block.id) !== -1;',
        '    });',
        '  }',
        '  return fn.blocks.filter(function (other) {',
        '    return block.succ.indexOf(other.id) !== -1;',
        '  });',
        '}',
        '',
        'function meetOver(analysis, universe, sets, neighbours) {',
        '  const side = analysis.direction === "forward" ? "out" : "in";',
        '',
        '  if (neighbours.length === 0) return [];',
        '',
        '  let acc = sets[neighbours[0].id][side].slice();',
        '',
        '  neighbours.slice(1).forEach(function (other) {',
        '    const value = sets[other.id][side];',
        '',
        '    acc = analysis.meet === "union" ? union(acc, value) : intersect(acc, value);',
        '  });',
        '  return sorted(acc);',
        '}',
        '',
        'function solve(fn, analysis, universe) {',
        '  const sets = {};',
        '  const start = initialFor(analysis, universe);',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    sets[block.id] = { in: start.slice(), out: start.slice() };',
        '  });',
        '',
        '  const queue = fn.blocks.map(function (block) { return block.id; });',
        '  let visits = 0;',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '    const block = fn.blocks.filter(function (b) { return b.id === id; })[0];',
        '    const input = meetOver(analysis, universe, sets, neighboursOf(fn, block, analysis));',
        '    const output = transfer(block, input);',
        '    const inSide = analysis.direction === "forward" ? input : output;',
        '    const outSide = analysis.direction === "forward" ? output : input;',
        '',
        '    visits += 1;',
        '    if (sets[id].in.join() === inSide.join() && sets[id].out.join() === outSide.join()) {',
        '      continue;',
        '    }',
        '    sets[id] = { in: inSide, out: outSide };',
        '    neighboursOf(fn, block, { direction: analysis.direction === "forward" ? "backward" : "forward" })',
        '      .forEach(function (other) {',
        '        if (queue.indexOf(other.id) === -1) queue.push(other.id);',
        '      });',
        '  }',
        '  return { sets: sets, visits: visits };',
        '}',
        '',
        'function lab() {',
        '  return { initialFor: initialFor, solve: solve, universeOf: universeOf };',
        '}'
      ].join('\n'),
      solution: [
        'function sorted(list) {',
        '  return list.slice().sort();',
        '}',
        '',
        'function union(a, b) {',
        '  return sorted(a.concat(b.filter(function (x) { return a.indexOf(x) === -1; })));',
        '}',
        '',
        'function intersect(a, b) {',
        '  return sorted(a.filter(function (x) { return b.indexOf(x) !== -1; }));',
        '}',
        '',
        'function universeOf(fn) {',
        '  const out = [];',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    block.gen.concat(block.kill).forEach(function (fact) {',
        '      if (out.indexOf(fact) === -1) out.push(fact);',
        '    });',
        '  });',
        '  return sorted(out);',
        '}',
        '',
        'function initialFor(analysis, universe) {',
        '  return analysis.meet === "union" ? [] : sorted(universe);',
        '}',
        '',
        'function transfer(block, input) {',
        '  return union(block.gen, input.filter(function (fact) {',
        '    return block.kill.indexOf(fact) === -1;',
        '  }));',
        '}',
        '',
        'function neighboursOf(fn, block, analysis) {',
        '  if (analysis.direction === "forward") {',
        '    return fn.blocks.filter(function (other) {',
        '      return other.succ.indexOf(block.id) !== -1;',
        '    });',
        '  }',
        '  return fn.blocks.filter(function (other) {',
        '    return block.succ.indexOf(other.id) !== -1;',
        '  });',
        '}',
        '',
        'function meetOver(analysis, universe, sets, neighbours) {',
        '  const side = analysis.direction === "forward" ? "out" : "in";',
        '',
        '  if (neighbours.length === 0) return [];',
        '',
        '  let acc = sets[neighbours[0].id][side].slice();',
        '',
        '  neighbours.slice(1).forEach(function (other) {',
        '    const value = sets[other.id][side];',
        '',
        '    acc = analysis.meet === "union" ? union(acc, value) : intersect(acc, value);',
        '  });',
        '  return sorted(acc);',
        '}',
        '',
        'function solve(fn, analysis, universe) {',
        '  const sets = {};',
        '  const start = initialFor(analysis, universe);',
        '',
        '  fn.blocks.forEach(function (block) {',
        '    sets[block.id] = { in: start.slice(), out: start.slice() };',
        '  });',
        '',
        '  const queue = fn.blocks.map(function (block) { return block.id; });',
        '  let visits = 0;',
        '',
        '  while (queue.length) {',
        '    const id = queue.shift();',
        '    const block = fn.blocks.filter(function (b) { return b.id === id; })[0];',
        '    const input = meetOver(analysis, universe, sets, neighboursOf(fn, block, analysis));',
        '    const output = transfer(block, input);',
        '    const inSide = analysis.direction === "forward" ? input : output;',
        '    const outSide = analysis.direction === "forward" ? output : input;',
        '',
        '    visits += 1;',
        '    if (sets[id].in.join() === inSide.join() && sets[id].out.join() === outSide.join()) {',
        '      continue;',
        '    }',
        '    sets[id] = { in: inSide, out: outSide };',
        '    neighboursOf(fn, block, { direction: analysis.direction === "forward" ? "backward" : "forward" })',
        '      .forEach(function (other) {',
        '        if (queue.indexOf(other.id) === -1) queue.push(other.id);',
        '      });',
        '  }',
        '  return { sets: sets, visits: visits };',
        '}',
        '',
        'function lab() {',
        '  return { initialFor: initialFor, solve: solve, universeOf: universeOf };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a union analysis starts empty and an intersection one starts at everything',
          assert: function (lab, api) {
            const parts = lab();
            const universe = ['a', 'b', 'c'];

            api.assert.deepEqual(parts.initialFor({ meet: 'union' }, universe), [],
              'union analyses start at the bottom of the lattice');
            api.assert.deepEqual(parts.initialFor({ meet: 'intersect' }, universe), ['a', 'b', 'c'],
              'intersection analyses start at the top, or the first meet fixes the answer');
          }
        },
        {
          name: 'available expressions survives a join it would otherwise lose',
          assert: function (lab, api) {
            const parts = lab();
            // Both arms compute e; it is available at the join on every path.
            const fn = { blocks: [
              { id: 'b0', succ: ['b1', 'b2'], gen: ['e'], kill: [] },
              { id: 'b1', succ: ['b3'], gen: [], kill: [] },
              { id: 'b2', succ: ['b3'], gen: [], kill: [] },
              { id: 'b3', succ: [], gen: [], kill: [] }
            ] };
            const universe = parts.universeOf(fn);
            const result = parts.solve(fn, { direction: 'forward', meet: 'intersect' }, universe);

            api.assert.deepEqual(universe, ['e'], 'one fact in this function');
            api.assert.deepEqual(result.sets.b3.in, ['e'],
              'available on every path to the join — an analysis started at empty reports nothing here');
            api.assert.deepEqual(result.sets.b0.in, [],
              'the boundary block still starts at empty');
          }
        },
        {
          name: 'liveness is backward and union, and the worklist counts its visits',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { blocks: [
              { id: 'b0', succ: ['b1'], gen: [], kill: ['x'] },
              { id: 'b1', succ: ['b2', 'b3'], gen: [], kill: [] },
              { id: 'b2', succ: [], gen: ['x'], kill: [] },
              { id: 'b3', succ: [], gen: [], kill: [] }
            ] };
            const result = parts.solve(fn, { direction: 'backward', meet: 'union' },
              parts.universeOf(fn));

            api.assert.deepEqual(result.sets.b1.out, ['x'],
              'live on SOME path out of b1, which is what union means');
            api.assert.deepEqual(result.sets.b0.out, ['x'], 'and still live out of b0');
            api.assert.deepEqual(result.sets.b0.in, [], 'b0 defines it, so it is not live in');
            api.assert.atLeast(result.visits, 4, 'every block ran its transfer function at least once');
          }
        }
      ]
    }],

    'scalar-optimisations': [{
      id: 'sccp-joint-fixpoint',
      title: 'Fold and prune together, and watch each unblock the other',
      prompt: 'A function is { blocks: [{ id, instructions: [{ dest, op, args, value }], ' +
        'terminator: { op, cond, targets } }] }, where op is "const", "add", "mul" or "phi" ' +
        'and a phi\'s args are [{ from, reg }]. Registers are named strings; a lattice value ' +
        'is "top", a number, or "bottom". Write meet(a, b) implementing the three-level ' +
        'lattice: top meets anything to that thing, two equal numbers meet to that number, and ' +
        'anything else is bottom. Write sccp(fn) returning { values: { reg: latticeValue }, ' +
        'executable: [blockId], folded, unreachable }, starting from the entry block with ' +
        'every register at top, marking a branch\'s successors executable only when its ' +
        'condition is not a known-false or known-true constant that rules one out, and meeting ' +
        'a phi ONLY over the operands arriving on executable edges. folded is how many ' +
        'registers ended at a number; unreachable is how many blocks never became executable. ' +
        'The starter meets every phi operand regardless of whether its edge can be taken, ' +
        'which is exactly the clause that makes the combination worth more than its parts.',
      entry: 'lab',
      starter: [
        'function meet(a, b) {',
        '  if (a === "top") return b;',
        '  if (b === "top") return a;',
        '  if (a === "bottom" || b === "bottom") return "bottom";',
        '  return a === b ? a : "bottom";',
        '}',
        '',
        'function evaluate(instruction, values, phiMeet) {',
        '  if (instruction.op === "const") return instruction.value;',
        '  if (instruction.op === "phi") return phiMeet(instruction);',
        '',
        '  const parts = instruction.args.map(function (reg) {',
        '    return values[reg] === undefined ? "top" : values[reg];',
        '  });',
        '',
        '  if (parts.indexOf("bottom") !== -1) return "bottom";',
        '  if (parts.indexOf("top") !== -1) return "top";',
        '  return instruction.op === "add" ? parts[0] + parts[1] : parts[0] * parts[1];',
        '}',
        '',
        'function successors(block, values) {',
        '  const term = block.terminator;',
        '',
        '  if (term.op !== "branch") return term.targets || [];',
        '',
        '  const cond = values[term.cond];',
        '',
        '  if (cond === undefined || cond === "top" || cond === "bottom") return term.targets;',
        '  return [cond ? term.targets[0] : term.targets[1]];',
        '}',
        '',
        'function sccp(fn) {',
        '  const values = {};',
        '  const executable = [fn.blocks[0].id];',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    fn.blocks.forEach(function (block) {',
        '      if (executable.indexOf(block.id) === -1) return;',
        '      block.instructions.forEach(function (instruction) {',
        '        // Every phi operand is met, including ones on edges that cannot be taken.',
        '        const next = evaluate(instruction, values, function (phi) {',
        '          return phi.args.reduce(function (acc, entry) {',
        '            const value = values[entry.reg] === undefined ? "top" : values[entry.reg];',
        '',
        '            return meet(acc, value);',
        '          }, "top");',
        '        });',
        '',
        '        if (values[instruction.dest] !== next) {',
        '          values[instruction.dest] = next;',
        '          changed = true;',
        '        }',
        '      });',
        '      successors(block, values).forEach(function (id) {',
        '        if (executable.indexOf(id) === -1) { executable.push(id); changed = true; }',
        '      });',
        '    });',
        '  }',
        '',
        '  const folded = Object.keys(values).filter(function (reg) {',
        '    return values[reg] !== "top" && values[reg] !== "bottom";',
        '  }).length;',
        '',
        '  return { values: values, executable: executable.slice().sort(), folded: folded,',
        '    unreachable: fn.blocks.length - executable.length };',
        '}',
        '',
        'function lab() {',
        '  return { meet: meet, sccp: sccp };',
        '}'
      ].join('\n'),
      solution: [
        'function meet(a, b) {',
        '  if (a === "top") return b;',
        '  if (b === "top") return a;',
        '  if (a === "bottom" || b === "bottom") return "bottom";',
        '  return a === b ? a : "bottom";',
        '}',
        '',
        'function evaluate(instruction, values, phiMeet) {',
        '  if (instruction.op === "const") return instruction.value;',
        '  if (instruction.op === "phi") return phiMeet(instruction);',
        '',
        '  const parts = instruction.args.map(function (reg) {',
        '    return values[reg] === undefined ? "top" : values[reg];',
        '  });',
        '',
        '  if (parts.indexOf("bottom") !== -1) return "bottom";',
        '  if (parts.indexOf("top") !== -1) return "top";',
        '  return instruction.op === "add" ? parts[0] + parts[1] : parts[0] * parts[1];',
        '}',
        '',
        'function successors(block, values) {',
        '  const term = block.terminator;',
        '',
        '  if (term.op !== "branch") return term.targets || [];',
        '',
        '  const cond = values[term.cond];',
        '',
        '  if (cond === undefined || cond === "top" || cond === "bottom") return term.targets;',
        '  return [cond ? term.targets[0] : term.targets[1]];',
        '}',
        '',
        'function sccp(fn) {',
        '  const values = {};',
        '  const executable = [fn.blocks[0].id];',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    fn.blocks.forEach(function (block) {',
        '      if (executable.indexOf(block.id) === -1) return;',
        '      block.instructions.forEach(function (instruction) {',
        '        const next = evaluate(instruction, values, function (phi) {',
        '          return phi.args.reduce(function (acc, entry) {',
        '            if (executable.indexOf(entry.from) === -1) return acc;',
        '',
        '            const value = values[entry.reg] === undefined ? "top" : values[entry.reg];',
        '',
        '            return meet(acc, value);',
        '          }, "top");',
        '        });',
        '',
        '        if (values[instruction.dest] !== next) {',
        '          values[instruction.dest] = next;',
        '          changed = true;',
        '        }',
        '      });',
        '      successors(block, values).forEach(function (id) {',
        '        if (executable.indexOf(id) === -1) { executable.push(id); changed = true; }',
        '      });',
        '    });',
        '  }',
        '',
        '  const folded = Object.keys(values).filter(function (reg) {',
        '    return values[reg] !== "top" && values[reg] !== "bottom";',
        '  }).length;',
        '',
        '  return { values: values, executable: executable.slice().sort(), folded: folded,',
        '    unreachable: fn.blocks.length - executable.length };',
        '}',
        '',
        'function lab() {',
        '  return { meet: meet, sccp: sccp };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the lattice has three levels and meeting two different constants gives bottom',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.meet('top', 4), 4, 'top is the identity');
            api.assert.equal(parts.meet(4, 4), 4, 'two equal constants stay constant');
            api.assert.equal(parts.meet(4, 5), 'bottom', 'two different ones are not');
            api.assert.equal(parts.meet('bottom', 4), 'bottom', 'bottom absorbs');
          }
        },
        {
          name: 'a phi meets only the operands arriving on executable edges',
          assert: function (lab, api) {
            const parts = lab();
            // The branch is a known false, so the b1 edge cannot be taken — but z is
            // defined in the entry block, so its value is perfectly well known.
            const fn = { blocks: [
              { id: 'b0',
                instructions: [
                  { dest: 'c', op: 'const', value: 0 },
                  { dest: 'x', op: 'const', value: 7 },
                  { dest: 'z', op: 'const', value: 99 }
                ],
                terminator: { op: 'branch', cond: 'c', targets: ['b1', 'b2'] } },
              { id: 'b1', instructions: [], terminator: { op: 'jump', targets: ['b3'] } },
              { id: 'b2', instructions: [], terminator: { op: 'jump', targets: ['b3'] } },
              { id: 'b3',
                instructions: [{ dest: 'p', op: 'phi',
                  args: [{ from: 'b1', reg: 'z' }, { from: 'b2', reg: 'x' }] }],
                terminator: { op: 'return', targets: [] } }
            ] };
            const result = parts.sccp(fn);

            api.assert.equal(result.values.p, 7,
              'only b2 is executable, so the phi is the constant 7 — meeting both gives bottom');
            api.assert.equal(result.unreachable, 1, 'b1 never became executable');
            api.assert.equal(result.executable.indexOf('b1'), -1, 'and is not listed');
          }
        },
        {
          name: 'a value that depends on the dead branch folds all the way through',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { blocks: [
              { id: 'b0',
                instructions: [
                  { dest: 'c', op: 'const', value: 0 },
                  { dest: 'x', op: 'const', value: 3 },
                  { dest: 'z', op: 'const', value: 100 }
                ],
                terminator: { op: 'branch', cond: 'c', targets: ['b1', 'b2'] } },
              { id: 'b1', instructions: [], terminator: { op: 'jump', targets: ['b3'] } },
              { id: 'b2', instructions: [], terminator: { op: 'jump', targets: ['b3'] } },
              { id: 'b3',
                instructions: [
                  { dest: 'p', op: 'phi',
                    args: [{ from: 'b1', reg: 'z' }, { from: 'b2', reg: 'x' }] },
                  { dest: 'q', op: 'mul', args: ['p', 'p'] }
                ],
                terminator: { op: 'return', targets: [] } }
            ] };
            const result = parts.sccp(fn);

            api.assert.equal(result.values.q, 9, 'three squared, because the phi stayed constant');
            api.assert.equal(result.folded, 5, 'c, x, z, p and q all ended at a number');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

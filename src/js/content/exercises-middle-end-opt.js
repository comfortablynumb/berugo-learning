/**
 * Graded exercises for loops, calls, aliasing and verification (M29.7-M29.10).
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
    'loop-optimisations': [{
      id: 'safe-licm',
      title: 'Hoist what is invariant, and refuse what could fault',
      prompt: 'A loop is { header, blocks: [id], exits: [id], preheader, instructions: [{ reg, ' +
        'block, op, args }] }, plus dominates(a, b) telling you whether block a dominates ' +
        'block b. Registers named in args that no instruction defines come from outside the ' +
        'loop. Write invariant(loop) returning the sorted registers whose operands are all ' +
        'defined outside the loop or are themselves invariant — a FIXPOINT, because one ' +
        'invariant definition can make another invariant. Write mayFault(op) returning true ' +
        'only for "div" and "rem", as a whitelist so a new opcode is unsafe by default. Write ' +
        'hoistable(loop) returning { hoisted: [reg], refused: [{ reg, reason }] }, both sorted ' +
        'by register: an invariant instruction is hoisted unless the loop has no preheader ' +
        '("no preheader to hoist into") or it may fault and its block does not dominate every ' +
        'exit ("may fault, and its block does not dominate every loop exit"). The starter ' +
        'computes invariance in one sweep and hoists anything it finds, which is the pass that ' +
        'turns a working program into a division by zero.',
      entry: 'lab',
      starter: [
        'function definedInside(loop) {',
        '  return loop.instructions.map(function (instruction) { return instruction.reg; });',
        '}',
        '',
        'function invariant(loop) {',
        '  const inside = definedInside(loop);',
        '',
        '  // One sweep: a value built from another invariant value is never found.',
        '  return loop.instructions.filter(function (instruction) {',
        '    return instruction.args.every(function (arg) {',
        '      return inside.indexOf(arg) === -1;',
        '    });',
        '  }).map(function (instruction) { return instruction.reg; }).sort();',
        '}',
        '',
        'function mayFault(op) {',
        '  return op === "div" || op === "rem";',
        '}',
        '',
        'function hoistable(loop) {',
        '  // Anything invariant moves, with no question asked about faulting.',
        '  return { hoisted: invariant(loop).slice().sort(), refused: [] };',
        '}',
        '',
        'function lab() {',
        '  return { invariant: invariant, mayFault: mayFault, hoistable: hoistable };',
        '}'
      ].join('\n'),
      solution: [
        'function definedInside(loop) {',
        '  return loop.instructions.map(function (instruction) { return instruction.reg; });',
        '}',
        '',
        'function invariant(loop) {',
        '  const inside = definedInside(loop);',
        '  const found = [];',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    loop.instructions.forEach(function (instruction) {',
        '      if (found.indexOf(instruction.reg) !== -1) return;',
        '',
        '      const ready = instruction.args.every(function (arg) {',
        '        return inside.indexOf(arg) === -1 || found.indexOf(arg) !== -1;',
        '      });',
        '',
        '      if (!ready) return;',
        '      found.push(instruction.reg);',
        '      changed = true;',
        '    });',
        '  }',
        '  return found.sort();',
        '}',
        '',
        'function mayFault(op) {',
        '  return op === "div" || op === "rem";',
        '}',
        '',
        'function refusalFor(loop, instruction) {',
        '  if (!loop.preheader) return "no preheader to hoist into";',
        '  if (!mayFault(instruction.op)) return null;',
        '',
        '  const safe = loop.exits.every(function (exit) {',
        '    return loop.dominates(instruction.block, exit);',
        '  });',
        '',
        '  return safe ? null : "may fault, and its block does not dominate every loop exit";',
        '}',
        '',
        'function hoistable(loop) {',
        '  const names = invariant(loop);',
        '  const hoisted = [];',
        '  const refused = [];',
        '',
        '  loop.instructions.forEach(function (instruction) {',
        '    if (names.indexOf(instruction.reg) === -1) return;',
        '',
        '    const reason = refusalFor(loop, instruction);',
        '',
        '    if (reason) refused.push({ reg: instruction.reg, reason: reason });',
        '    else hoisted.push(instruction.reg);',
        '  });',
        '  refused.sort(function (a, b) { return a.reg < b.reg ? -1 : 1; });',
        '  return { hoisted: hoisted.sort(), refused: refused };',
        '}',
        '',
        'function lab() {',
        '  return { invariant: invariant, mayFault: mayFault, hoistable: hoistable };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'invariance is a fixpoint, so one invariant value makes the next one invariant',
          assert: function (lab, api) {
            const parts = lab();
            const loop = {
              header: 'b1', blocks: ['b1', 'b2'], exits: ['b3'], preheader: 'b0',
              dominates: function () { return true; },
              instructions: [
                { reg: 'a', block: 'b1', op: 'add', args: ['n', 'm'] },
                { reg: 'b', block: 'b1', op: 'mul', args: ['a', 'n'] },
                { reg: 'c', block: 'b1', op: 'add', args: ['b', 'i'] },
                { reg: 'i', block: 'b1', op: 'add', args: ['i', 'one'] }
              ]
            };

            api.assert.deepEqual(parts.invariant(loop), ['a', 'b'],
              'b is built from a, and a single sweep finds only a');
            api.assert.equal(parts.invariant(loop).indexOf('c'), -1,
              'c depends on the induction variable');
          }
        },
        {
          name: 'mayFault is a whitelist, so an unknown opcode is not assumed safe',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.mayFault('div'), true, 'division can fault');
            api.assert.equal(parts.mayFault('rem'), true, 'and so can remainder');
            api.assert.equal(parts.mayFault('add'), false, 'arithmetic cannot');
            api.assert.equal(parts.mayFault('load'), false,
              'a load is not listed here, so it is not hoisted for a different reason');
          }
        },
        {
          name: 'a faulting instruction whose block misses an exit is refused, with a reason',
          assert: function (lab, api) {
            const parts = lab();
            const loop = {
              header: 'b1', blocks: ['b1', 'b2'], exits: ['b3'], preheader: 'b0',
              dominates: function (a) { return a !== 'b2'; },
              instructions: [
                { reg: 'a', block: 'b1', op: 'add', args: ['n', 'm'] },
                { reg: 'd', block: 'b2', op: 'div', args: ['n', 'm'] }
              ]
            };
            const result = parts.hoistable(loop);

            api.assert.deepEqual(result.hoisted, ['a'], 'the safe one moves');
            api.assert.equal(result.refused.length, 1, 'the division does not');
            api.assert.equal(result.refused[0].reg, 'd', 'and the refusal names it');
            api.assert.equal(result.refused[0].reason,
              'may fault, and its block does not dominate every loop exit',
              'with the reason, because a refusal nobody can read is a silent miss');
          }
        }
      ]
    }],

    'interprocedural-optimisation': [{
      id: 'graph-and-escape',
      title: 'Follow the copies, then say why each allocation escapes',
      prompt: 'A function is { name, instructions: [{ reg, op, args, callee }] }, where op is ' +
        '"move", "makeRecord", "makeClosure", "call", "return", "store" or "arg". A ' +
        '"makeClosure" names the function it closes over in callee. Write resolve(fn, reg) ' +
        'following move chains back to the instruction that really defines a register, ' +
        'returning that instruction or null — SSA renaming interposes a copy at every read, so ' +
        'a call names a copy rather than the closure. Write callGraph(fn) returning [{ from, ' +
        'to, kind }] in instruction order, where kind is "direct" when resolve reaches a ' +
        'makeClosure and "indirect" otherwise, and to is the callee name or null. Write ' +
        'escapes(fn) returning one row per allocation as { reg, escapes, why }: "returned" ' +
        'when it is returned, "captured by a closure" when a makeClosure closes over it, ' +
        '"passed to a call, which this analysis cannot see into" when it is an argument, and ' +
        '"never leaves this frame" otherwise. The starter reads the call\'s operand directly ' +
        'instead of following it, so every call comes out indirect and the report is a ' +
        'plausible zero.',
      entry: 'lab',
      starter: [
        'function find(fn, reg) {',
        '  return fn.instructions.filter(function (i) { return i.reg === reg; })[0] || null;',
        '}',
        '',
        'function resolve(fn, reg) {',
        '  // No chain following: one hop and stop.',
        '  return find(fn, reg);',
        '}',
        '',
        'function callGraph(fn) {',
        '  return fn.instructions.filter(function (i) { return i.op === "call"; })',
        '    .map(function (i) {',
        '      const target = resolve(fn, i.args[0]);',
        '      const direct = target && target.op === "makeClosure";',
        '',
        '      return { from: fn.name, to: direct ? target.callee : null,',
        '        kind: direct ? "direct" : "indirect" };',
        '    });',
        '}',
        '',
        'const ALLOCATIONS = ["makeRecord", "makeClosure"];',
        '',
        'function reasonFor(fn, reg) {',
        '  let reason = "never leaves this frame";',
        '',
        '  fn.instructions.forEach(function (i) {',
        '    if (i.op === "return" && i.args.indexOf(reg) !== -1) reason = "returned";',
        '  });',
        '  return reason;',
        '}',
        '',
        'function escapes(fn) {',
        '  return fn.instructions.filter(function (i) {',
        '    return ALLOCATIONS.indexOf(i.op) !== -1;',
        '  }).map(function (i) {',
        '    const why = reasonFor(fn, i.reg);',
        '',
        '    return { reg: i.reg, escapes: why !== "never leaves this frame", why: why };',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { resolve: resolve, callGraph: callGraph, escapes: escapes };',
        '}'
      ].join('\n'),
      solution: [
        'function find(fn, reg) {',
        '  return fn.instructions.filter(function (i) { return i.reg === reg; })[0] || null;',
        '}',
        '',
        'function resolve(fn, reg) {',
        '  const seen = [];',
        '  let current = find(fn, reg);',
        '',
        '  while (current && current.op === "move") {',
        '    if (seen.indexOf(current.reg) !== -1) return null;',
        '    seen.push(current.reg);',
        '    current = find(fn, current.args[0]);',
        '  }',
        '  return current;',
        '}',
        '',
        'function callGraph(fn) {',
        '  return fn.instructions.filter(function (i) { return i.op === "call"; })',
        '    .map(function (i) {',
        '      const target = resolve(fn, i.args[0]);',
        '      const direct = Boolean(target) && target.op === "makeClosure";',
        '',
        '      return { from: fn.name, to: direct ? target.callee : null,',
        '        kind: direct ? "direct" : "indirect" };',
        '    });',
        '}',
        '',
        'const ALLOCATIONS = ["makeRecord", "makeClosure"];',
        '',
        'function reasonFor(fn, reg) {',
        '  const aliases = [reg];',
        '',
        '  fn.instructions.forEach(function (i) {',
        '    if (i.op === "move" && aliases.indexOf(i.args[0]) !== -1) aliases.push(i.reg);',
        '  });',
        '',
        '  let reason = "never leaves this frame";',
        '',
        '  fn.instructions.forEach(function (i) {',
        '    const touches = (i.args || []).some(function (a) {',
        '      return aliases.indexOf(a) !== -1;',
        '    });',
        '',
        '    if (!touches) return;',
        '    if (i.op === "return") reason = "returned";',
        '    else if (i.op === "makeClosure") reason = "captured by a closure";',
        '    else if (i.op === "arg" && reason === "never leaves this frame") {',
        '      reason = "passed to a call, which this analysis cannot see into";',
        '    }',
        '  });',
        '  return reason;',
        '}',
        '',
        'function escapes(fn) {',
        '  return fn.instructions.filter(function (i) {',
        '    return ALLOCATIONS.indexOf(i.op) !== -1;',
        '  }).map(function (i) {',
        '    const why = reasonFor(fn, i.reg);',
        '',
        '    return { reg: i.reg, escapes: why !== "never leaves this frame", why: why };',
        '  });',
        '}',
        '',
        'function lab() {',
        '  return { resolve: resolve, callGraph: callGraph, escapes: escapes };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a call through two copies is still a direct call',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { name: 'main', instructions: [
              { reg: '%0', op: 'makeClosure', args: [], callee: 'read' },
              { reg: '%1', op: 'move', args: ['%0'] },
              { reg: '%2', op: 'move', args: ['%1'] },
              { reg: '%3', op: 'call', args: ['%2'] }
            ] };

            api.assert.equal(parts.resolve(fn, '%2').op, 'makeClosure',
              'the chain ends at the allocation, not at the copy');
            api.assert.deepEqual(parts.callGraph(fn),
              [{ from: 'main', to: 'read', kind: 'direct' }],
              'one direct edge — reading the operand gives a plausible zero instead');
          }
        },
        {
          name: 'a call through a parameter has no callee to name',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { name: 'apply', instructions: [
              { reg: '%1', op: 'move', args: ['%f'] },
              { reg: '%2', op: 'call', args: ['%1'] }
            ] };
            const graph = parts.callGraph(fn);

            api.assert.equal(graph.length, 1, 'one call');
            api.assert.equal(graph[0].kind, 'indirect', 'through a value it cannot trace');
            api.assert.equal(graph[0].to, null, 'so there is no callee to name');
          }
        },
        {
          name: 'each allocation reports the reason, not just the verdict',
          assert: function (lab, api) {
            const parts = lab();
            const fn = { name: 'main', instructions: [
              { reg: '%0', op: 'makeRecord', args: [] },
              { reg: '%1', op: 'makeRecord', args: [] },
              { reg: '%2', op: 'makeRecord', args: [] },
              { reg: '%3', op: 'move', args: ['%1'] },
              { reg: '%4', op: 'arg', args: ['%3'] },
              { reg: '%5', op: 'return', args: ['%2'] }
            ] };
            const rows = parts.escapes(fn);

            api.assert.equal(rows.length, 3, 'three allocations');
            api.assert.equal(rows[0].why, 'never leaves this frame', '%0 stays');
            api.assert.equal(rows[1].why,
              'passed to a call, which this analysis cannot see into',
              '%1 escapes conservatively, through a copy of itself');
            api.assert.equal(rows[2].why, 'returned', '%2 escapes exactly');
          }
        }
      ]
    }],

    'alias-analysis': [{
      id: 'inclusion-and-unification',
      title: 'Two points-to analyses on the same program, and one oracle over both',
      prompt: 'A program is [{ op, dest, site }] where op is "alloc" (dest points at site), ' +
        '"assign" (dest gains everything src points at — src is in site) or "merge" (dest ' +
        'gains from both of sites). Write andersen(program) returning { reg: [site] } with ' +
        'each list sorted, solving the subset constraints to a fixpoint. Write ' +
        'steensgaard(program) returning the same shape, but merging the classes instead: an ' +
        'assignment unions the two registers permanently and symmetrically, so both end with ' +
        'the same set. Write pairs(pointsTo) returning the sorted "a|b" strings for every ' +
        'unordered pair of distinct registers whose sets overlap. Write sound(pointsTo, ' +
        'observed) returning { reported, observed, missed, sound } where missed counts pairs ' +
        'in observed that pointsTo does not report. The starter implements assignment as a ' +
        'merge in BOTH analyses, so Andersen loses its direction and reports Steensgaard\'s ' +
        'answer.',
      entry: 'lab',
      starter: [
        'function addAll(target, source) {',
        '  let changed = false;',
        '',
        '  source.forEach(function (site) {',
        '    if (target.indexOf(site) === -1) { target.push(site); changed = true; }',
        '  });',
        '  return changed;',
        '}',
        '',
        'function blank(program) {',
        '  const sets = {};',
        '',
        '  program.forEach(function (step) {',
        '    if (!sets[step.dest]) sets[step.dest] = [];',
        '    if (step.op === "assign" && !sets[step.site]) sets[step.site] = [];',
        '    if (step.op === "merge") {',
        '      step.sites.forEach(function (reg) { if (!sets[reg]) sets[reg] = []; });',
        '    }',
        '  });',
        '  return sets;',
        '}',
        '',
        'function andersen(program) {',
        '  const sets = blank(program);',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    program.forEach(function (step) {',
        '      if (step.op === "alloc") {',
        '        if (addAll(sets[step.dest], [step.site])) changed = true;',
        '        return;',
        '      }',
        '      if (step.op === "assign") {',
        '        // Symmetric: this is unification wearing an inclusion label.',
        '        if (addAll(sets[step.dest], sets[step.site])) changed = true;',
        '        if (addAll(sets[step.site], sets[step.dest])) changed = true;',
        '        return;',
        '      }',
        '      step.sites.forEach(function (reg) {',
        '        if (addAll(sets[step.dest], sets[reg])) changed = true;',
        '      });',
        '    });',
        '  }',
        '  Object.keys(sets).forEach(function (reg) { sets[reg].sort(); });',
        '  return sets;',
        '}',
        '',
        'function steensgaard(program) {',
        '  const sets = blank(program);',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    program.forEach(function (step) {',
        '      if (step.op === "alloc") {',
        '        if (addAll(sets[step.dest], [step.site])) changed = true;',
        '        return;',
        '      }',
        '',
        '      const others = step.op === "assign" ? [step.site] : step.sites;',
        '',
        '      others.forEach(function (reg) {',
        '        if (addAll(sets[step.dest], sets[reg])) changed = true;',
        '        if (addAll(sets[reg], sets[step.dest])) changed = true;',
        '      });',
        '    });',
        '  }',
        '  Object.keys(sets).forEach(function (reg) { sets[reg].sort(); });',
        '  return sets;',
        '}',
        '',
        'function pairs(pointsTo) {',
        '  const regs = Object.keys(pointsTo).sort();',
        '  const out = [];',
        '',
        '  regs.forEach(function (a, index) {',
        '    regs.slice(index + 1).forEach(function (b) {',
        '      const overlap = pointsTo[a].some(function (site) {',
        '        return pointsTo[b].indexOf(site) !== -1;',
        '      });',
        '',
        '      if (overlap) out.push(a + "|" + b);',
        '    });',
        '  });',
        '  return out.sort();',
        '}',
        '',
        'function sound(pointsTo, observed) {',
        '  const reported = pairs(pointsTo);',
        '  const missed = observed.filter(function (pair) {',
        '    return reported.indexOf(pair) === -1;',
        '  });',
        '',
        '  return { reported: reported.length, observed: observed.length,',
        '    missed: missed.length, sound: missed.length === 0 };',
        '}',
        '',
        'function lab() {',
        '  return { andersen: andersen, steensgaard: steensgaard, pairs: pairs, sound: sound };',
        '}'
      ].join('\n'),
      solution: [
        'function addAll(target, source) {',
        '  let changed = false;',
        '',
        '  source.forEach(function (site) {',
        '    if (target.indexOf(site) === -1) { target.push(site); changed = true; }',
        '  });',
        '  return changed;',
        '}',
        '',
        'function blank(program) {',
        '  const sets = {};',
        '',
        '  program.forEach(function (step) {',
        '    if (!sets[step.dest]) sets[step.dest] = [];',
        '    if (step.op === "assign" && !sets[step.site]) sets[step.site] = [];',
        '    if (step.op === "merge") {',
        '      step.sites.forEach(function (reg) { if (!sets[reg]) sets[reg] = []; });',
        '    }',
        '  });',
        '  return sets;',
        '}',
        '',
        'function andersen(program) {',
        '  const sets = blank(program);',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    program.forEach(function (step) {',
        '      if (step.op === "alloc") {',
        '        if (addAll(sets[step.dest], [step.site])) changed = true;',
        '        return;',
        '      }',
        '',
        '      const others = step.op === "assign" ? [step.site] : step.sites;',
        '',
        '      others.forEach(function (reg) {',
        '        if (addAll(sets[step.dest], sets[reg])) changed = true;',
        '      });',
        '    });',
        '  }',
        '  Object.keys(sets).forEach(function (reg) { sets[reg].sort(); });',
        '  return sets;',
        '}',
        '',
        'function steensgaard(program) {',
        '  const sets = blank(program);',
        '  let changed = true;',
        '',
        '  while (changed) {',
        '    changed = false;',
        '    program.forEach(function (step) {',
        '      if (step.op === "alloc") {',
        '        if (addAll(sets[step.dest], [step.site])) changed = true;',
        '        return;',
        '      }',
        '',
        '      const others = step.op === "assign" ? [step.site] : step.sites;',
        '',
        '      others.forEach(function (reg) {',
        '        if (addAll(sets[step.dest], sets[reg])) changed = true;',
        '        if (addAll(sets[reg], sets[step.dest])) changed = true;',
        '      });',
        '    });',
        '  }',
        '  Object.keys(sets).forEach(function (reg) { sets[reg].sort(); });',
        '  return sets;',
        '}',
        '',
        'function pairs(pointsTo) {',
        '  const regs = Object.keys(pointsTo).sort();',
        '  const out = [];',
        '',
        '  regs.forEach(function (a, index) {',
        '    regs.slice(index + 1).forEach(function (b) {',
        '      const overlap = pointsTo[a].some(function (site) {',
        '        return pointsTo[b].indexOf(site) !== -1;',
        '      });',
        '',
        '      if (overlap) out.push(a + "|" + b);',
        '    });',
        '  });',
        '  return out.sort();',
        '}',
        '',
        'function sound(pointsTo, observed) {',
        '  const reported = pairs(pointsTo);',
        '  const missed = observed.filter(function (pair) {',
        '    return reported.indexOf(pair) === -1;',
        '  });',
        '',
        '  return { reported: reported.length, observed: observed.length,',
        '    missed: missed.length, sound: missed.length === 0 };',
        '}',
        '',
        'function lab() {',
        '  return { andersen: andersen, steensgaard: steensgaard, pairs: pairs, sound: sound };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'inclusion is directional and unification is not',
          assert: function (lab, api) {
            const parts = lab();
            const program = [
              { op: 'alloc', dest: 'p', site: 's1' },
              { op: 'alloc', dest: 'q', site: 's2' },
              { op: 'assign', dest: 'p', site: 'q' }
            ];
            const inclusion = parts.andersen(program);
            const unified = parts.steensgaard(program);

            api.assert.deepEqual(inclusion.p, ['s1', 's2'], 'p learns about q');
            api.assert.deepEqual(inclusion.q, ['s2'], 'and q learns nothing about p');
            api.assert.deepEqual(unified.q, ['s1', 's2'],
              'unification teaches both, permanently and symmetrically');
          }
        },
        {
          name: 'unification reports more may-alias pairs than inclusion on the same program',
          assert: function (lab, api) {
            const parts = lab();
            const program = [
              { op: 'alloc', dest: 'p', site: 's1' },
              { op: 'alloc', dest: 'q', site: 's2' },
              { op: 'alloc', dest: 'r', site: 's1' },
              { op: 'assign', dest: 'p', site: 'q' }
            ];
            const lean = parts.pairs(parts.andersen(program));
            const coarse = parts.pairs(parts.steensgaard(program));

            api.assert.equal(lean.indexOf('q|r'), -1,
              'inclusion keeps q and r apart — q points only at s2');
            api.assert.notEqual(coarse.indexOf('q|r'), -1,
              'unification has merged them, so they may alias');
            api.assert.equal(coarse.length > lean.length, true,
              'the merge costs precision, measurably');
          }
        },
        {
          name: 'the oracle can prove an analysis unsound and never prove one right',
          assert: function (lab, api) {
            const parts = lab();
            const program = [
              { op: 'alloc', dest: 'p', site: 's1' },
              { op: 'alloc', dest: 'q', site: 's2' },
              { op: 'assign', dest: 'p', site: 'q' }
            ];
            const verdict = parts.sound(parts.andersen(program), ['p|q']);

            api.assert.equal(verdict.missed, 0, 'the pair that happened is reported');
            api.assert.equal(verdict.sound, true, 'so the analysis is sound on this input');
            api.assert.equal(verdict.reported >= verdict.observed, true,
              'a static answer must be a superset of what happened');

            const broken = parts.sound({ p: ['s1'], q: ['s2'] }, ['p|q']);

            api.assert.equal(broken.sound, false, 'and a missed pair is a definite bug');
          }
        }
      ]
    }],

    'verifying-the-optimiser': [{
      id: 'shrink-a-failure',
      title: 'Reduce a failing program without changing which bug it is',
      prompt: 'A program is an array of statement strings. You are given fails(program) ' +
        'returning null when it passes or { pass, kind } when it fails, and valid(program) ' +
        'returning whether it parses and resolves, both through a tools object. Write ' +
        'candidates(program) returning every ' +
        'one-edit reduction in this order: each program with one statement removed, from the ' +
        'last statement to the first. Write accepts(original, judged) returning whether a ' +
        'judged candidate — { valid, failure } — may be taken: it must be valid, and it must ' +
        'fail at the SAME pass with the SAME kind as the original failure. Write ' +
        'shrink(program, tools) returning { program, ' +
        'rounds, tried, accepted } — greedily take the FIRST acceptable candidate, then ' +
        'recompute the list from the new program, until a round accepts nothing. The starter ' +
        'walks the whole candidate list without recomputing, so a later candidate is the old ' +
        'program with one change and accepting it silently undoes the acceptance before it.',
      entry: 'lab',
      starter: [
        'function candidates(program) {',
        '  const out = [];',
        '',
        '  for (let index = program.length - 1; index >= 0; index -= 1) {',
        '    out.push(program.slice(0, index).concat(program.slice(index + 1)));',
        '  }',
        '  return out;',
        '}',
        '',
        'function accepts(original, candidate) {',
        '  if (!candidate.valid) return false;',
        '  if (!candidate.failure) return false;',
        '  return candidate.failure.pass === original.pass &&',
        '    candidate.failure.kind === original.kind;',
        '}',
        '',
        'function judge(program, tools) {',
        '  return { valid: tools.valid(program), failure: tools.fails(program) };',
        '}',
        '',
        'function shrink(program, tools) {',
        '  const original = tools.fails(program);',
        '  const list = candidates(program);',
        '  let current = program;',
        '  let tried = 0;',
        '  let accepted = 0;',
        '',
        '  // The list is never recomputed: every candidate is an edit of the ORIGINAL.',
        '  list.forEach(function (candidate) {',
        '    tried += 1;',
        '    if (!accepts(original, judge(candidate, tools))) return;',
        '    current = candidate;',
        '    accepted += 1;',
        '  });',
        '  return { program: current, rounds: 1, tried: tried, accepted: accepted };',
        '}',
        '',
        'function lab() {',
        '  return { candidates: candidates, accepts: accepts, shrink: shrink };',
        '}'
      ].join('\n'),
      solution: [
        'function candidates(program) {',
        '  const out = [];',
        '',
        '  for (let index = program.length - 1; index >= 0; index -= 1) {',
        '    out.push(program.slice(0, index).concat(program.slice(index + 1)));',
        '  }',
        '  return out;',
        '}',
        '',
        'function accepts(original, candidate) {',
        '  if (!candidate.valid) return false;',
        '  if (!candidate.failure) return false;',
        '  return candidate.failure.pass === original.pass &&',
        '    candidate.failure.kind === original.kind;',
        '}',
        '',
        'function judge(program, tools) {',
        '  return { valid: tools.valid(program), failure: tools.fails(program) };',
        '}',
        '',
        'function firstAcceptable(current, original, tools, counter) {',
        '  const list = candidates(current);',
        '  let found = null;',
        '',
        '  list.some(function (candidate) {',
        '    counter.tried += 1;',
        '    if (!accepts(original, judge(candidate, tools))) return false;',
        '    found = candidate;',
        '    return true;',
        '  });',
        '  return found;',
        '}',
        '',
        'function shrink(program, tools) {',
        '  const original = tools.fails(program);',
        '  const counter = { tried: 0 };',
        '  let current = program;',
        '  let rounds = 0;',
        '  let accepted = 0;',
        '  let next = firstAcceptable(current, original, tools, counter);',
        '',
        '  while (next) {',
        '    current = next;',
        '    accepted += 1;',
        '    rounds += 1;',
        '    next = firstAcceptable(current, original, tools, counter);',
        '  }',
        '  return { program: current, rounds: rounds + 1, tried: counter.tried,',
        '    accepted: accepted };',
        '}',
        '',
        'function lab() {',
        '  return { candidates: candidates, accepts: accepts, shrink: shrink };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a candidate that does not parse is refused, however well it fails',
          assert: function (lab, api) {
            const parts = lab();
            const original = { pass: 'licm', kind: 'wrong-answer' };

            api.assert.equal(parts.accepts(original,
              { valid: false, failure: { pass: 'licm', kind: 'wrong-answer' } }), false,
              'an invalid program is a report about undefined behaviour, not about the pass');
            api.assert.equal(parts.accepts(original,
              { valid: true, failure: { pass: 'licm', kind: 'wrong-answer' } }), true,
              'a valid one failing the same way is taken');
          }
        },
        {
          name: 'a candidate that fails differently has replaced the bug',
          assert: function (lab, api) {
            const parts = lab();
            const original = { pass: 'licm', kind: 'wrong-answer' };

            api.assert.equal(parts.accepts(original,
              { valid: true, failure: { pass: 'sccp', kind: 'wrong-answer' } }), false,
              'a different pass is a different bug');
            api.assert.equal(parts.accepts(original,
              { valid: true, failure: { pass: 'licm', kind: 'verifier' } }), false,
              'and so is a different kind of failure');
            api.assert.equal(parts.accepts(original, { valid: true, failure: null }),
              false, 'a candidate that passes is not a reduction of anything');
          }
        },
        {
          name: 'the list is recomputed after every acceptance, or the reducer reverts itself',
          assert: function (lab, api) {
            const parts = lab();
            // The failure needs "div" and "guard". Everything else can go.
            const tools = {
              valid: function (program) {
                return program.indexOf('div') === -1 || program.indexOf('let d') !== -1;
              },
              fails: function (program) {
                const keeps = program.indexOf('div') !== -1 && program.indexOf('guard') !== -1;

                return keeps ? { pass: 'licm', kind: 'wrong-answer' } : null;
              }
            };
            const program = ['let d', 'noise1', 'guard', 'noise2', 'div', 'noise3'];
            const result = parts.shrink(program, tools);

            api.assert.deepEqual(result.program, ['let d', 'guard', 'div'],
              'every removable statement is gone, and the declaration the validity gate needs stays');
            api.assert.equal(result.accepted, 3, 'three statements removed');
            api.assert.atLeast(result.rounds, 4,
              'one round per acceptance, plus the round that accepts nothing');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

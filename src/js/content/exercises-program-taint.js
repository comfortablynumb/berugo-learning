/**
 * Graded exercises for taint analysis and symbolic execution (M32.3-M32.4).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'taint-analysis': [{
      id: 'taint-to-a-fixpoint',
      title: 'Propagate taint until nothing changes',
      prompt: 'A programme is a list of instructions, and a loop is modelled by running the ' +
        'list again. The instructions are { op: "source", target }, { op: "move", target, ' +
        'from }, { op: "binary", target, left, right } and { op: "call", target, name, args }. ' +
        'A call whose name is in policy.sanitisers clears the taint of its target; one in ' +
        'policy.sinks reports a finding if any argument is tainted; anything else taints its ' +
        'target if any argument is tainted. Write analyse(instructions, policy) returning ' +
        '{ findings, rounds, tainted } and run it to a FIXPOINT: keep sweeping the list until ' +
        'a sweep changes nothing. The starter sweeps once, which is correct on straight-line ' +
        'code and silently misses every flow that arrives round a loop.',
      entry: 'lab',
      starter: [
        'function sweep(instructions, policy, state, findings) {',
        '  let changed = false;',
        '',
        '  instructions.forEach(function (inst) {',
        '    if (inst.op === "source") {',
        '      if (!state[inst.target]) { state[inst.target] = true; changed = true; }',
        '      return;',
        '    }',
        '    if (inst.op === "move") {',
        '      if (state[inst.from] && !state[inst.target]) {',
        '        state[inst.target] = true; changed = true;',
        '      }',
        '      return;',
        '    }',
        '    if (inst.op === "binary") {',
        '      if ((state[inst.left] || state[inst.right]) && !state[inst.target]) {',
        '        state[inst.target] = true; changed = true;',
        '      }',
        '      return;',
        '    }',
        '    if (applyCall(inst, policy, state, findings)) changed = true;',
        '  });',
        '  return changed;',
        '}',
        '',
        'function applyCall(inst, policy, state, findings) {',
        '  const dirty = (inst.args || []).filter(function (arg) { return state[arg]; });',
        '',
        '  if (policy.sanitisers.indexOf(inst.name) !== -1) {',
        '    state[inst.target] = false;',
        '    return false;',
        '  }',
        '  if (policy.sinks.indexOf(inst.name) !== -1) {',
        '    if (!dirty.length) return false;',
        '    const already = findings.some(function (row) { return row.at === inst; });',
        '',
        '    if (already) return false;',
        '    findings.push({ at: inst, sink: inst.name, arg: dirty[0] });',
        '    return true;',
        '  }',
        '  if (!dirty.length || state[inst.target]) return false;',
        '  state[inst.target] = true;',
        '  return true;',
        '}',
        '',
        'function analyse(instructions, policy) {',
        '  const state = {};',
        '  const findings = [];',
        '',
        '  // One sweep. A value tainted later in the list than it was copied is',
        '  // never seen, which is exactly what a loop does.',
        '  sweep(instructions, policy, state, findings);',
        '  return { findings: findings, rounds: 1,',
        '    tainted: Object.keys(state).filter(function (name) { return state[name]; }) };',
        '}',
        '',
        'function lab() {',
        '  return { analyse: analyse, sweep: sweep };',
        '}'
      ].join('\n'),
      solution: [
        'function sweep(instructions, policy, state, findings) {',
        '  let changed = false;',
        '',
        '  instructions.forEach(function (inst) {',
        '    if (inst.op === "source") {',
        '      if (!state[inst.target]) { state[inst.target] = true; changed = true; }',
        '      return;',
        '    }',
        '    if (inst.op === "move") {',
        '      if (state[inst.from] && !state[inst.target]) {',
        '        state[inst.target] = true; changed = true;',
        '      }',
        '      return;',
        '    }',
        '    if (inst.op === "binary") {',
        '      if ((state[inst.left] || state[inst.right]) && !state[inst.target]) {',
        '        state[inst.target] = true; changed = true;',
        '      }',
        '      return;',
        '    }',
        '    if (applyCall(inst, policy, state, findings)) changed = true;',
        '  });',
        '  return changed;',
        '}',
        '',
        'function applyCall(inst, policy, state, findings) {',
        '  const dirty = (inst.args || []).filter(function (arg) { return state[arg]; });',
        '',
        '  if (policy.sanitisers.indexOf(inst.name) !== -1) {',
        '    state[inst.target] = false;',
        '    return false;',
        '  }',
        '  if (policy.sinks.indexOf(inst.name) !== -1) {',
        '    if (!dirty.length) return false;',
        '    const already = findings.some(function (row) { return row.at === inst; });',
        '',
        '    if (already) return false;',
        '    findings.push({ at: inst, sink: inst.name, arg: dirty[0] });',
        '    return true;',
        '  }',
        '  if (!dirty.length || state[inst.target]) return false;',
        '  state[inst.target] = true;',
        '  return true;',
        '}',
        '',
        '/* Sweep until a sweep changes nothing. The bound exists because the',
        '   lattice is one bit per name and taint is only ever added within a',
        '   sweep, so the number of rounds cannot exceed the number of names by',
        '   more than one - but asserting the bound beats trusting it. */',
        'function analyse(instructions, policy) {',
        '  const state = {};',
        '  const findings = [];',
        '  let rounds = 0;',
        '',
        '  while (rounds < 50 && sweep(instructions, policy, state, findings)) {',
        '    rounds += 1;',
        '  }',
        '  return { findings: findings, rounds: rounds + 1,',
        '    tainted: Object.keys(state).filter(function (name) { return state[name]; }) };',
        '}',
        '',
        'function lab() {',
        '  return { analyse: analyse, sweep: sweep };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a source reaching a sink is reported',
          assert: function (lab, api) {
            const parts = lab();
            const policy = { sources: ['read'], sinks: ['query'], sanitisers: ['escape'] };
            const out = parts.analyse([
              { op: 'source', target: 'raw' },
              { op: 'call', target: 'r', name: 'query', args: ['raw'] }
            ], policy);

            api.assert.equal(out.findings.length, 1, 'the sink received a tainted value');
            api.assert.equal(out.findings[0].arg, 'raw', 'and it names the argument');
          }
        },
        {
          name: 'a sanitised value is not reported',
          assert: function (lab, api) {
            const parts = lab();
            const policy = { sources: ['read'], sinks: ['query'], sanitisers: ['escape'] };
            const out = parts.analyse([
              { op: 'source', target: 'raw' },
              { op: 'call', target: 'safe', name: 'escape', args: ['raw'] },
              { op: 'call', target: 'r', name: 'query', args: ['safe'] }
            ], policy);

            api.assert.equal(out.findings.length, 0, 'the sanitiser cleared the taint');
          }
        },
        {
          name: 'taint that arrives round the loop is still reported',
          assert: function (lab, api) {
            const parts = lab();
            const policy = { sources: ['read'], sinks: ['query'], sanitisers: ['escape'] };
            const out = parts.analyse([
              { op: 'move', target: 'u', from: 't' },
              { op: 'source', target: 't' },
              { op: 'call', target: 'r', name: 'query', args: ['u'] }
            ], policy);

            api.assert.equal(out.findings.length, 1,
              'u is tainted on the second time round the list');
            api.assert.ok(out.rounds >= 2, 'which takes more than one sweep, found ' +
              out.rounds);
          }
        },
        {
          name: 'arithmetic on a tainted operand carries the taint',
          assert: function (lab, api) {
            const parts = lab();
            const policy = { sources: ['read'], sinks: ['query'], sanitisers: ['escape'] };
            const out = parts.analyse([
              { op: 'source', target: 'raw' },
              { op: 'binary', target: 'sum', left: 'raw', right: 'k' },
              { op: 'call', target: 'r', name: 'query', args: ['sum'] }
            ], policy);

            api.assert.equal(out.findings.length, 1, 'the sum is tainted');
            api.assert.ok(out.tainted.indexOf('sum') !== -1, 'and the state says so');
          }
        }
      ]
    }],

    'symbolic-execution': [{
      id: 'path-conditions-that-really-reach',
      title: 'Accumulate a path condition and generate an input that follows it',
      prompt: 'A programme is a binary decision tree over one integer `a`: a node is ' +
        '{ op: "gt" | "lt", value, then, other } and a leaf is { leaf: name }. Write ' +
        'paths(tree) returning one entry per leaf as { leaf, condition } where condition is a ' +
        'list of { op, value, negated }; solve(condition) returning an integer in -20..20 ' +
        'satisfying every constraint or null if there is none; and run(tree, a) returning the ' +
        'leaf a concrete input reaches. The starter records the branch condition on BOTH ' +
        'sides without negating it on the else branch, so the inputs it generates go to the ' +
        'wrong leaf — which only shows up if you execute them.',
      entry: 'lab',
      starter: [
        'function paths(tree) {',
        '  const out = [];',
        '',
        '  walk(tree, [], out);',
        '  return out;',
        '}',
        '',
        'function walk(node, condition, out) {',
        '  if (node.leaf) { out.push({ leaf: node.leaf, condition: condition }); return; }',
        '  // The else branch gets the same constraint, unnegated.',
        '  walk(node.then, condition.concat([',
        '    { op: node.op, value: node.value, negated: false }]), out);',
        '  walk(node.other, condition.concat([',
        '    { op: node.op, value: node.value, negated: false }]), out);',
        '}',
        '',
        'function holds(row, a) {',
        '  const raw = row.op === "gt" ? a > row.value : a < row.value;',
        '',
        '  return row.negated ? !raw : raw;',
        '}',
        '',
        'function solve(condition) {',
        '  for (let a = -20; a <= 20; a += 1) {',
        '    if (condition.every(function (row) { return holds(row, a); })) return a;',
        '  }',
        '  return null;',
        '}',
        '',
        'function run(tree, a) {',
        '  let node = tree;',
        '',
        '  while (!node.leaf) {',
        '    const taken = node.op === "gt" ? a > node.value : a < node.value;',
        '',
        '    node = taken ? node.then : node.other;',
        '  }',
        '  return node.leaf;',
        '}',
        '',
        'function lab() {',
        '  return { paths: paths, solve: solve, run: run, holds: holds };',
        '}'
      ].join('\n'),
      solution: [
        'function paths(tree) {',
        '  const out = [];',
        '',
        '  walk(tree, [], out);',
        '  return out;',
        '}',
        '',
        '/* The negation on the else branch IS the path condition. Without it',
        '   every leaf claims the conditions of the path that reaches its',
        '   sibling, and the generated inputs are valid solutions to the wrong',
        '   question. */',
        'function walk(node, condition, out) {',
        '  if (node.leaf) { out.push({ leaf: node.leaf, condition: condition }); return; }',
        '  walk(node.then, condition.concat([',
        '    { op: node.op, value: node.value, negated: false }]), out);',
        '  walk(node.other, condition.concat([',
        '    { op: node.op, value: node.value, negated: true }]), out);',
        '}',
        '',
        'function holds(row, a) {',
        '  const raw = row.op === "gt" ? a > row.value : a < row.value;',
        '',
        '  return row.negated ? !raw : raw;',
        '}',
        '',
        'function solve(condition) {',
        '  for (let a = -20; a <= 20; a += 1) {',
        '    if (condition.every(function (row) { return holds(row, a); })) return a;',
        '  }',
        '  return null;',
        '}',
        '',
        'function run(tree, a) {',
        '  let node = tree;',
        '',
        '  while (!node.leaf) {',
        '    const taken = node.op === "gt" ? a > node.value : a < node.value;',
        '',
        '    node = taken ? node.then : node.other;',
        '  }',
        '  return node.leaf;',
        '}',
        '',
        'function lab() {',
        '  return { paths: paths, solve: solve, run: run, holds: holds };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every generated input reaches the leaf it was generated for',
          assert: function (lab, api) {
            const parts = lab();
            const tree = { op: 'gt', value: 10,
              then: { op: 'lt', value: 20, then: { leaf: 'a' }, other: { leaf: 'b' } },
              other: { leaf: 'c' } };
            const rows = parts.paths(tree);

            api.assert.equal(rows.length, 3, 'three leaves');
            rows.forEach(function (row) {
              const input = parts.solve(row.condition);

              if (input === null) return;
              api.assert.equal(parts.run(tree, input), row.leaf,
                'input ' + input + ' was generated for ' + row.leaf);
            });
          }
        },
        {
          name: 'a contradictory path condition has no solution',
          assert: function (lab, api) {
            const parts = lab();
            const tree = { op: 'gt', value: 10,
              then: { op: 'lt', value: 5, then: { leaf: 'dead' }, other: { leaf: 'live' } },
              other: { leaf: 'small' } };
            const dead = parts.paths(tree).filter(function (row) {
              return row.leaf === 'dead';
            })[0];

            api.assert.ok(dead, 'the dead leaf is in the tree');
            api.assert.equal(parts.solve(dead.condition), null,
              'a > 10 and a < 5 has no solution');
          }
        },
        {
          name: 'every leaf is reachable by some input, or provably not',
          assert: function (lab, api) {
            const parts = lab();
            const tree = { op: 'gt', value: 0,
              then: { leaf: 'positive' }, other: { leaf: 'not positive' } };
            const rows = parts.paths(tree);
            const reached = {};

            rows.forEach(function (row) {
              const input = parts.solve(row.condition);

              api.assert.ok(input !== null, 'both leaves of this tree are reachable');
              reached[parts.run(tree, input)] = true;
            });
            api.assert.equal(Object.keys(reached).length, 2,
              'and the two inputs reach two different leaves');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

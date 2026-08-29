/**
 * Graded exercises for gates, minimisation and the blocks (M33.1-M33.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'boolean-algebra-and-gates': [{
      id: 'evaluate-a-netlist',
      title: 'Evaluate a netlist whose gates are not in dependency order',
      prompt: 'A netlist is { inputs: ["a", "b"], gates: [{ id, type, in: [...] }], output: id }, '
        + 'where a gate input names either an input or another gate\'s id, and the gate list is '
        + 'in NO particular order. Write lab() returning { evaluate, minterms }. evaluate(net, '
        + 'values) returns the output bit for values keyed by input name; minterms(net) returns '
        + 'the ascending list of input masks where the output is 1, with the FIRST input as the '
        + 'most significant bit. Gate types are not, and, or, nand, nor, xor. The starter walks '
        + 'the gate list once in the order given, so a gate that names a gate defined later '
        + 'reads undefined and silently evaluates it as 0.',
      entry: 'lab',
      starter: [
        'function gateValue(type, ins) {',
        '  if (type === "not") return ins[0] ? 0 : 1;',
        '  if (type === "and") return ins[0] && ins[1] ? 1 : 0;',
        '  if (type === "or") return ins[0] || ins[1] ? 1 : 0;',
        '  if (type === "nand") return ins[0] && ins[1] ? 0 : 1;',
        '  if (type === "nor") return ins[0] || ins[1] ? 0 : 1;',
        '  return (ins[0] ? 1 : 0) !== (ins[1] ? 1 : 0) ? 1 : 0;',
        '}',
        '',
        'function evaluate(net, values) {',
        '  const wires = {};',
        '',
        '  net.inputs.forEach(function (name) { wires[name] = values[name] ? 1 : 0; });',
        '  // One pass, in the order the gates happen to be listed. A gate whose',
        '  // input is defined later in the list reads undefined here.',
        '  net.gates.forEach(function (gate) {',
        '    wires[gate.id] = gateValue(gate.type, gate.in.map(function (name) {',
        '      return wires[name] ? 1 : 0;',
        '    }));',
        '  });',
        '  return wires[net.output] ? 1 : 0;',
        '}',
        '',
        'function minterms(net) {',
        '  const width = net.inputs.length;',
        '  const out = [];',
        '',
        '  for (let mask = 0; mask < Math.pow(2, width); mask += 1) {',
        '    const values = {};',
        '',
        '    net.inputs.forEach(function (name, at) {',
        '      values[name] = (mask >> (width - 1 - at)) & 1;',
        '    });',
        '    if (evaluate(net, values)) out.push(mask);',
        '  }',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { evaluate: evaluate, minterms: minterms };',
        '}'
      ].join('\n'),
      solution: [
        'function gateValue(type, ins) {',
        '  if (type === "not") return ins[0] ? 0 : 1;',
        '  if (type === "and") return ins[0] && ins[1] ? 1 : 0;',
        '  if (type === "or") return ins[0] || ins[1] ? 1 : 0;',
        '  if (type === "nand") return ins[0] && ins[1] ? 0 : 1;',
        '  if (type === "nor") return ins[0] || ins[1] ? 0 : 1;',
        '  return (ins[0] ? 1 : 0) !== (ins[1] ? 1 : 0) ? 1 : 0;',
        '}',
        '',
        '/* Resolve on demand rather than in list order. A combinational netlist',
        '   is a DAG, so recursion terminates; memoising makes it one pass. */',
        'function resolve(net, wires, name) {',
        '  if (wires[name] !== undefined) return wires[name];',
        '  const gate = net.gates.filter(function (row) { return row.id === name; })[0];',
        '',
        '  if (!gate) throw new Error("no such wire: " + name);',
        '  const ins = gate.in.map(function (source) { return resolve(net, wires, source); });',
        '',
        '  wires[name] = gateValue(gate.type, ins);',
        '  return wires[name];',
        '}',
        '',
        'function evaluate(net, values) {',
        '  const wires = {};',
        '',
        '  net.inputs.forEach(function (name) { wires[name] = values[name] ? 1 : 0; });',
        '  return resolve(net, wires, net.output) ? 1 : 0;',
        '}',
        '',
        'function minterms(net) {',
        '  const width = net.inputs.length;',
        '  const out = [];',
        '',
        '  for (let mask = 0; mask < Math.pow(2, width); mask += 1) {',
        '    const values = {};',
        '',
        '    net.inputs.forEach(function (name, at) {',
        '      values[name] = (mask >> (width - 1 - at)) & 1;',
        '    });',
        '    if (evaluate(net, values)) out.push(mask);',
        '  }',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { evaluate: evaluate, minterms: minterms };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'exclusive-or from four NANDs, with the gates listed backwards',
          assert: function (lab, api) {
            const parts = lab();
            const net = {
              inputs: ['a', 'b'],
              gates: [
                { id: 'y', type: 'nand', in: ['n2', 'n3'] },
                { id: 'n3', type: 'nand', in: ['b', 'n1'] },
                { id: 'n2', type: 'nand', in: ['a', 'n1'] },
                { id: 'n1', type: 'nand', in: ['a', 'b'] }
              ],
              output: 'y'
            };

            api.assert.equal(parts.evaluate(net, { a: 0, b: 0 }), 0, '0 xor 0');
            api.assert.equal(parts.evaluate(net, { a: 1, b: 0 }), 1, '1 xor 0');
            api.assert.equal(parts.evaluate(net, { a: 0, b: 1 }), 1, '0 xor 1');
            api.assert.equal(parts.evaluate(net, { a: 1, b: 1 }), 0, '1 xor 1');
          }
        },
        {
          name: 'majority of three has minterms 3, 5, 6 and 7',
          assert: function (lab, api) {
            const parts = lab();
            const net = {
              inputs: ['a', 'b', 'c'],
              gates: [
                { id: 'y', type: 'or', in: ['t', 'bc'] },
                { id: 't', type: 'or', in: ['ab', 'ac'] },
                { id: 'bc', type: 'and', in: ['b', 'c'] },
                { id: 'ac', type: 'and', in: ['a', 'c'] },
                { id: 'ab', type: 'and', in: ['a', 'b'] }
              ],
              output: 'y'
            };

            api.assert.deepEqual(parts.minterms(net), [3, 5, 6, 7],
              'majority is 1 on exactly the rows with two or more ones');
          }
        }
      ]
    }],
    'logic-minimisation': [{
      id: 'prime-implicants',
      title: 'Merge to a fixed point, then cover',
      prompt: 'A term is a string of "0", "1" and "-", most significant bit first. Write lab() '
        + 'returning { primes, cover }. primes(minterms, bits) returns the sorted list of prime '
        + 'implicants: start from one term per minterm, repeatedly merge any two terms that '
        + 'differ in exactly one position (replacing it with "-"), and keep every term that was '
        + 'never merged into a larger one. cover(minterms, bits) returns a sorted list of primes '
        + 'covering every minterm — take the essential ones first, then greedily take whichever '
        + 'prime covers the most of what is left. The starter merges only ONCE, so terms that '
        + 'need two rounds of merging never reach their final size.',
      entry: 'lab',
      starter: [
        'function termOf(mask, bits) {',
        '  let text = "";',
        '',
        '  for (let at = bits - 1; at >= 0; at -= 1) text += (mask >> at) & 1;',
        '  return text;',
        '}',
        '',
        'function merge(left, right) {',
        '  let seen = -1;',
        '',
        '  for (let at = 0; at < left.length; at += 1) {',
        '    if (left[at] === right[at]) continue;',
        '    if (seen !== -1) return null;',
        '    seen = at;',
        '  }',
        '  if (seen === -1) return null;',
        '  return left.slice(0, seen) + "-" + left.slice(seen + 1);',
        '}',
        '',
        'function covers(term, mask, bits) {',
        '  for (let at = 0; at < bits; at += 1) {',
        '    const ch = term[bits - 1 - at];',
        '',
        '    if (ch !== "-" && Number(ch) !== ((mask >> at) & 1)) return false;',
        '  }',
        '  return true;',
        '}',
        '',
        'function primes(minterms, bits) {',
        '  const current = minterms.map(function (mask) { return termOf(mask, bits); });',
        '  const used = {};',
        '  const found = {};',
        '',
        '  // One round of merging only. Two terms that could merge again after',
        '  // this round never do, so the answer is not prime.',
        '  current.forEach(function (left) {',
        '    current.forEach(function (right) {',
        '      const joined = merge(left, right);',
        '',
        '      if (joined === null) return;',
        '      used[left] = true;',
        '      used[right] = true;',
        '      found[joined] = true;',
        '    });',
        '  });',
        '  current.forEach(function (term) { if (!used[term]) found[term] = true; });',
        '  return Object.keys(found).sort();',
        '}',
        '',
        'function cover(minterms, bits) {',
        '  const all = primes(minterms, bits);',
        '  const chosen = [];',
        '  let left = minterms.slice();',
        '',
        '  minterms.forEach(function (mask) {',
        '    const owners = all.filter(function (term) { return covers(term, mask, bits); });',
        '',
        '    if (owners.length === 1 && chosen.indexOf(owners[0]) === -1) chosen.push(owners[0]);',
        '  });',
        '  left = left.filter(function (mask) {',
        '    return !chosen.some(function (term) { return covers(term, mask, bits); });',
        '  });',
        '  while (left.length) {',
        '    let best = null;',
        '    let score = 0;',
        '',
        '    all.forEach(function (term) {',
        '      if (chosen.indexOf(term) !== -1) return;',
        '      const gain = left.filter(function (mask) {',
        '        return covers(term, mask, bits);',
        '      }).length;',
        '',
        '      if (gain > score) { score = gain; best = term; }',
        '    });',
        '    if (best === null) break;',
        '    chosen.push(best);',
        '    left = left.filter(function (mask) { return !covers(best, mask, bits); });',
        '  }',
        '  return chosen.sort();',
        '}',
        '',
        'function lab() {',
        '  return { primes: primes, cover: cover };',
        '}'
      ].join('\n'),
      solution: [
        'function termOf(mask, bits) {',
        '  let text = "";',
        '',
        '  for (let at = bits - 1; at >= 0; at -= 1) text += (mask >> at) & 1;',
        '  return text;',
        '}',
        '',
        'function merge(left, right) {',
        '  let seen = -1;',
        '',
        '  for (let at = 0; at < left.length; at += 1) {',
        '    if (left[at] === right[at]) continue;',
        '    if (left[at] === "-" || right[at] === "-") return null;',
        '    if (seen !== -1) return null;',
        '    seen = at;',
        '  }',
        '  if (seen === -1) return null;',
        '  return left.slice(0, seen) + "-" + left.slice(seen + 1);',
        '}',
        '',
        'function covers(term, mask, bits) {',
        '  for (let at = 0; at < bits; at += 1) {',
        '    const ch = term[bits - 1 - at];',
        '',
        '    if (ch !== "-" && Number(ch) !== ((mask >> at) & 1)) return false;',
        '  }',
        '  return true;',
        '}',
        '',
        '/* Merge to a FIXED POINT: each round produces terms one dash larger,',
        '   and a term nobody merged is prime. */',
        'function primes(minterms, bits) {',
        '  let current = minterms.map(function (mask) { return termOf(mask, bits); });',
        '  const found = {};',
        '',
        '  while (current.length) {',
        '    const next = {};',
        '    const used = {};',
        '',
        '    current.forEach(function (left) {',
        '      current.forEach(function (right) {',
        '        const joined = merge(left, right);',
        '',
        '        if (joined === null) return;',
        '        used[left] = true;',
        '        used[right] = true;',
        '        next[joined] = true;',
        '      });',
        '    });',
        '    current.forEach(function (term) { if (!used[term]) found[term] = true; });',
        '    current = Object.keys(next);',
        '  }',
        '  return Object.keys(found).sort();',
        '}',
        '',
        'function cover(minterms, bits) {',
        '  const all = primes(minterms, bits);',
        '  const chosen = [];',
        '  let left = minterms.slice();',
        '',
        '  minterms.forEach(function (mask) {',
        '    const owners = all.filter(function (term) { return covers(term, mask, bits); });',
        '',
        '    if (owners.length === 1 && chosen.indexOf(owners[0]) === -1) chosen.push(owners[0]);',
        '  });',
        '  left = left.filter(function (mask) {',
        '    return !chosen.some(function (term) { return covers(term, mask, bits); });',
        '  });',
        '  while (left.length) {',
        '    let best = null;',
        '    let score = 0;',
        '',
        '    all.forEach(function (term) {',
        '      if (chosen.indexOf(term) !== -1) return;',
        '      const gain = left.filter(function (mask) {',
        '        return covers(term, mask, bits);',
        '      }).length;',
        '',
        '      if (gain > score) { score = gain; best = term; }',
        '    });',
        '    if (best === null) break;',
        '    chosen.push(best);',
        '    left = left.filter(function (mask) { return !covers(best, mask, bits); });',
        '  }',
        '  return chosen.sort();',
        '}',
        '',
        'function lab() {',
        '  return { primes: primes, cover: cover };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a function that is always 1 has exactly one prime implicant',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.deepEqual(parts.primes([0, 1, 2, 3], 2), ['--'],
              'four minterms over two variables merge twice, down to a single term');
          }
        },
        {
          name: 'the cover reproduces the function on every row',
          assert: function (lab, api) {
            const parts = lab();
            const minterms = [0, 1, 2, 5, 6, 7];
            const chosen = parts.cover(minterms, 3);
            const hits = function (term, mask) {
              for (let at = 0; at < 3; at += 1) {
                const ch = term[2 - at];

                if (ch !== '-' && Number(ch) !== ((mask >> at) & 1)) return false;
              }
              return true;
            };

            for (let mask = 0; mask < 8; mask += 1) {
              const got = chosen.some(function (term) { return hits(term, mask); }) ? 1 : 0;
              const want = minterms.indexOf(mask) === -1 ? 0 : 1;

              api.assert.equal(got, want, 'row ' + mask + ' of the cover');
            }
            api.assert.ok(chosen.length <= 4, 'and it uses at most four terms');
          }
        }
      ]
    }],
    'combinational-blocks': [{
      id: 'priority-and-shift',
      title: 'A priority encoder and a barrel shifter, by their specifications',
      prompt: 'Write lab() returning { priority, shift }. priority(bits) takes an array where '
        + 'index 0 is the least significant input and returns { index, valid }: the index of '
        + 'the HIGHEST set input, with valid false and index 0 when nothing is set. '
        + 'shift(word, amount, width, rotate) shifts word left by amount within width bits, '
        + 'filling with zeros — or, when rotate is true, wrapping the bits that fall off the '
        + 'top back into the bottom. The starter reports the LOWEST set input and ignores the '
        + 'rotate flag, which are the two mistakes these blocks exist to make you notice.',
      entry: 'lab',
      starter: [
        'function priority(bits) {',
        '  // The lowest set input, which is a perfectly good encoder and the',
        '  // wrong answer for a PRIORITY encoder.',
        '  for (let at = 0; at < bits.length; at += 1) {',
        '    if (bits[at]) return { index: at, valid: true };',
        '  }',
        '  return { index: 0, valid: false };',
        '}',
        '',
        'function shift(word, amount, width, rotate) {',
        '  const mask = Math.pow(2, width) - 1;',
        '',
        '  return (word << amount) & mask;',
        '}',
        '',
        'function lab() {',
        '  return { priority: priority, shift: shift };',
        '}'
      ].join('\n'),
      solution: [
        '/* Scanning upwards and keeping the last hit is the software version of',
        '   "input i wins only if nothing above it is set" — the chain that makes',
        '   a priority encoder deeper than a plain one. */',
        'function priority(bits) {',
        '  let winner = -1;',
        '',
        '  for (let at = 0; at < bits.length; at += 1) {',
        '    if (bits[at]) winner = at;',
        '  }',
        '  return { index: winner < 0 ? 0 : winner, valid: winner >= 0 };',
        '}',
        '',
        'function shift(word, amount, width, rotate) {',
        '  const mask = Math.pow(2, width) - 1;',
        '  const by = amount % width;',
        '',
        '  if (by === 0) return word & mask;',
        '  const moved = (word << by) & mask;',
        '',
        '  return rotate ? (moved | ((word >> (width - by)) & mask)) : moved;',
        '}',
        '',
        'function lab() {',
        '  return { priority: priority, shift: shift };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the priority encoder reports the highest set input, with a valid flag',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.deepEqual(parts.priority([1, 0, 1, 0]), { index: 2, valid: true },
              'inputs 0 and 2 are set, so 2 wins');
            api.assert.deepEqual(parts.priority([0, 0, 0, 1]), { index: 3, valid: true },
              'only input 3 is set');
            api.assert.deepEqual(parts.priority([0, 0, 0, 0]), { index: 0, valid: false },
              'nothing set is why the valid flag has to exist');
          }
        },
        {
          name: 'the shifter fills with zeros, and rotates when asked',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.shift(19, 1, 8, false), 38, '19 shifted left once is 38');
            api.assert.equal(parts.shift(19, 2, 8, false), 76, 'and twice is 76');
            api.assert.equal(parts.shift(200, 2, 8, false), 32,
              'bits shifted past the top are lost when not rotating');
            api.assert.equal(parts.shift(200, 2, 8, true), 35,
              'and come back at the bottom when rotating');
            api.assert.equal(parts.shift(19, 0, 8, true), 19, 'a zero shift is the identity');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

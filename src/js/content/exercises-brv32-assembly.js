/**
 * Graded exercises for assembly programming (M34.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'assembly-programming': [{
      id: 'calling-convention',
      title: 'A frame that survives its own recursive call',
      prompt: 'Model the calling convention as a machine, and write a recursive function that '
        + 'obeys it. Write lab() returning { frame, factorial }. frame(saved) returns the '
        + 'prologue and epilogue for a function that must preserve the listed registers: '
        + '{ size, prologue, epilogue }, where size is 4 bytes per saved register rounded up to '
        + 'a multiple of 8 (the stack stays 8-byte aligned), prologue is an array of strings '
        + 'starting with "addi sp, sp, -SIZE" and then one "sw REG, OFFSET(sp)" per register at '
        + 'offsets 0, 4, 8 ... in the order given, and epilogue is the matching loads followed '
        + 'by "addi sp, sp, SIZE". factorial(n) computes n! by recursion using a simulated call '
        + 'stack: push the argument and a marker for the return, recurse, and multiply on the '
        + 'way back — returning { value, maxDepth }, where maxDepth is the greatest number of '
        + 'frames live at once. The starter forgets the alignment and never restores the stack '
        + 'pointer.',
      entry: 'lab',
      starter: [
        'function frame(saved) {',
        '  // Two problems: the size is not rounded to the 8-byte alignment the',
        '  // convention requires, and the epilogue never puts sp back.',
        '  const size = saved.length * 4;',
        '  const prologue = ["addi sp, sp, -" + size];',
        '  const epilogue = [];',
        '',
        '  saved.forEach(function (reg, at) {',
        '    prologue.push("sw " + reg + ", " + (at * 4) + "(sp)");',
        '    epilogue.push("lw " + reg + ", " + (at * 4) + "(sp)");',
        '  });',
        '  return { size: size, prologue: prologue, epilogue: epilogue };',
        '}',
        '',
        'function factorial(n) {',
        '  // No frames at all, so the depth is a guess.',
        '  let value = 1;',
        '',
        '  for (let i = 2; i <= n; i += 1) value *= i;',
        '  return { value: value, maxDepth: 1 };',
        '}',
        '',
        'function lab() {',
        '  return { frame: frame, factorial: factorial };',
        '}'
      ].join('\n'),
      solution: [
        '/* The stack stays 8-byte aligned, so an odd number of saved words still',
        '   costs an even number of them. The epilogue is the prologue backwards:',
        '   every load matches a store, and the last thing it does is put the',
        '   stack pointer back exactly where it found it. */',
        'function frame(saved) {',
        '  const size = Math.ceil(saved.length * 4 / 8) * 8;',
        '  const prologue = ["addi sp, sp, -" + size];',
        '  const epilogue = [];',
        '',
        '  saved.forEach(function (reg, at) {',
        '    prologue.push("sw " + reg + ", " + (at * 4) + "(sp)");',
        '    epilogue.push("lw " + reg + ", " + (at * 4) + "(sp)");',
        '  });',
        '  epilogue.push("addi sp, sp, " + size);',
        '  return { size: size, prologue: prologue, epilogue: epilogue };',
        '}',
        '',
        '/* An explicit stack, so the depth is measured rather than assumed. Each',
        '   entry is one invocation: the argument it was called with, which its own',
        '   recursive call would otherwise destroy. */',
        'function factorial(n) {',
        '  const stack = [];',
        '  let maxDepth = 0;',
        '',
        '  for (let arg = n; arg >= 2; arg -= 1) {',
        '    stack.push(arg);',
        '    if (stack.length > maxDepth) maxDepth = stack.length;',
        '  }',
        '',
        '  let value = 1;',
        '',
        '  while (stack.length) value *= stack.pop();',
        '  return { value: value, maxDepth: Math.max(1, maxDepth) };',
        '}',
        '',
        'function lab() {',
        '  return { frame: frame, factorial: factorial };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the frame for a return address and an argument is the factorial\'s own',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.frame(['ra', 'a0']);

            api.assert.equal(got.size, 8, 'two words, and already aligned');
            api.assert.deepEqual(got.prologue,
              ['addi sp, sp, -8', 'sw ra, 0(sp)', 'sw a0, 4(sp)'],
              'the prologue moves the pointer once and then stores');
            api.assert.deepEqual(got.epilogue,
              ['lw ra, 0(sp)', 'lw a0, 4(sp)', 'addi sp, sp, 8'],
              'and the epilogue puts sp back — that last line is the one that gets forgotten');
          }
        },
        {
          name: 'an odd number of saved words still costs an aligned frame',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.frame(['ra']).size, 8, 'one word, rounded up to 8');
            api.assert.equal(parts.frame(['ra', 's0', 's1']).size, 16, 'three words, rounded to 16');
            api.assert.equal(parts.frame(['ra', 's0', 's1', 's2']).size, 16, 'four words fit exactly');
          }
        },
        {
          name: 'every store in the prologue has a load in the epilogue, at the same offset',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.frame(['ra', 's0', 's1']);
            const stores = got.prologue.slice(1).map(function (line) {
              return line.replace('sw ', '');
            });
            const loads = got.epilogue.slice(0, -1).map(function (line) {
              return line.replace('lw ', '');
            });

            api.assert.deepEqual(loads, stores, 'the epilogue undoes exactly the prologue');
            api.assert.equal(got.epilogue[got.epilogue.length - 1], 'addi sp, sp, 16',
              'and the pointer comes back last');
          }
        },
        {
          name: 'the recursion is five frames deep for 5!, and returns 120',
          assert: function (lab, api) {
            const parts = lab();
            const got = parts.factorial(5);

            api.assert.equal(got.value, 120, '5! is 120');
            api.assert.equal(got.maxDepth, 4,
              'arguments 5, 4, 3 and 2 each get a frame; the base case at 1 does not recurse');
            api.assert.equal(parts.factorial(1).value, 1, 'the base case');
            api.assert.equal(parts.factorial(1).maxDepth, 1, 'and it is still one invocation');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

/**
 * Graded exercises for regular-expression engines and text processing (M15.10-M15.11).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'regex-engines': [{
      id: 'state-set-simulation',
      title: 'The set that must be a set',
      prompt: 'simulate(program, text) must return { matched, steps, peak }. `program` is ' +
        '{ instructions, start }, where an instruction is { kind: "char", ch, next }, ' +
        '{ kind: "split", a, b } or { kind: "accept" }. Take the epsilon closure of the start ' +
        'instruction, then for each character keep every state whose `char` matches and close over ' +
        'the results; `matched` is whether an `accept` survives at the end. A split consumes ' +
        'nothing and is never in the set — its two successors are. `steps` counts states ADDED ' +
        'across every closure and `peak` is the largest set. The whole guarantee is that a set ' +
        'cannot be larger than the machine, so the same state reached by two paths must be stored ' +
        'once: the starter pushes it twice, and on `(a|a)*b` its "set" doubles with every ' +
        'character while returning the right answer.',
      entry: 'simulate',
      starter: [
        'function simulate(program, text) {',
        '  const instructions = program.instructions;',
        '  let steps = 0;',
        '  let peak = 0;',
        '',
        '  function closure(indices) {',
        '    const seen = [];',
        '    const stack = indices.slice();',
        '',
        '    while (stack.length > 0) {',
        '      const index = stack.pop();',
        '      const inst = instructions[index];',
        '',
        '      if (inst.kind === "split") { stack.push(inst.a); stack.push(inst.b); continue; }',
        '',
        '      // no membership check: two paths to one state store it twice',
        '      seen.push(index);',
        '      steps += 1;',
        '    }',
        '',
        '    if (seen.length > peak) peak = seen.length;',
        '    return seen;',
        '  }',
        '  let current = closure([program.start]);',
        '',
        '  for (let i = 0; i < text.length; i += 1) {',
        '    const next = [];',
        '',
        '    current.forEach(function (index) {',
        '      const inst = instructions[index];',
        '',
        '      if (inst.kind !== "char" || inst.ch !== text[i]) return;',
        '      next.push(inst.next);',
        '    });',
        '    current = closure(next);',
        '  }',
        '  const matched = current.some(function (index) {',
        '    return instructions[index].kind === "accept";',
        '  });',
        '  return { matched: matched, steps: steps, peak: peak };',
        '}'
      ].join('\n'),
      solution: [
        'function simulate(program, text) {',
        '  const instructions = program.instructions;',
        '  let steps = 0;',
        '  let peak = 0;',
        '',
        '  function closure(indices) {',
        '    const seen = [];',
        '    const visited = [];',
        '    const stack = indices.slice();',
        '',
        '    while (stack.length > 0) {',
        '      const index = stack.pop();',
        '',
        '      // visiting covers splits too, so an epsilon cycle terminates',
        '      if (visited.indexOf(index) !== -1) continue;',
        '      visited.push(index);',
        '      const inst = instructions[index];',
        '',
        '      if (inst.kind === "split") { stack.push(inst.a); stack.push(inst.b); continue; }',
        '      seen.push(index);',
        '      steps += 1;',
        '    }',
        '',
        '    if (seen.length > peak) peak = seen.length;',
        '    return seen;',
        '  }',
        '  let current = closure([program.start]);',
        '',
        '  for (let i = 0; i < text.length; i += 1) {',
        '    const next = [];',
        '',
        '    current.forEach(function (index) {',
        '      const inst = instructions[index];',
        '',
        '      if (inst.kind !== "char" || inst.ch !== text[i]) return;',
        '      if (next.indexOf(inst.next) === -1) next.push(inst.next);',
        '    });',
        '    current = closure(next);',
        '  }',
        '  const matched = current.some(function (index) {',
        '    return instructions[index].kind === "accept";',
        '  });',
        '  return { matched: matched, steps: steps, peak: peak };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'both machines accept exactly the right strings',
          assert: function (simulate, api) {
            const starB = {
              start: 0,
              instructions: [
                { kind: 'split', a: 1, b: 2 },
                { kind: 'char', ch: 'a', next: 0 },
                { kind: 'char', ch: 'b', next: 3 },
                { kind: 'accept' }
              ]
            };
            const ambiguous = {
              start: 0,
              instructions: [
                { kind: 'split', a: 1, b: 4 },
                { kind: 'split', a: 2, b: 3 },
                { kind: 'char', ch: 'a', next: 0 },
                { kind: 'char', ch: 'a', next: 0 },
                { kind: 'char', ch: 'b', next: 5 },
                { kind: 'accept' }
              ]
            };
            [['b', true], ['ab', true], ['aaab', true], ['', false], ['aaa', false], ['ba', false]]
              .forEach(function (row) {
                api.assert.equal(simulate(starB, row[0]).matched, row[1],
                  'a*b on "' + row[0] + '"');
                api.assert.equal(simulate(ambiguous, row[0]).matched, row[1],
                  '(a|a)*b on "' + row[0] + '"');
              });
          }
        },
        {
          name: 'the set stays a set on an ambiguous machine',
          assert: function (simulate, api) {
            const ambiguous = {
              start: 0,
              instructions: [
                { kind: 'split', a: 1, b: 4 },
                { kind: 'split', a: 2, b: 3 },
                { kind: 'char', ch: 'a', next: 0 },
                { kind: 'char', ch: 'a', next: 0 },
                { kind: 'char', ch: 'b', next: 5 },
                { kind: 'accept' }
              ]
            };
            let text = '';

            for (let i = 0; i < 12; i += 1) text += 'a';
            const got = simulate(ambiguous, text + 'b');

            api.assert.equal(got.matched, true, 'twelve a-s then b is a match');
            api.assert.atMost(got.peak, 6, 'the set cannot be larger than the 6-state machine');
            api.assert.atMost(got.steps, 6 * 14,
              'at most one entry per state per character boundary');
          }
        },
        {
          name: 'five hundred characters cost five hundred steps, not more',
          assert: function (simulate, api) {
            const starB = {
              start: 0,
              instructions: [
                { kind: 'split', a: 1, b: 2 },
                { kind: 'char', ch: 'a', next: 0 },
                { kind: 'char', ch: 'b', next: 3 },
                { kind: 'accept' }
              ]
            };
            let text = '';

            for (let i = 0; i < 500; i += 1) text += 'a';
            const got = simulate(starB, text + 'b');

            api.assert.equal(got.matched, true, 'the long string matches');
            api.assert.atMost(got.peak, 4, 'four instructions bound the set');
            api.assert.atMost(got.steps, 4 * 502, 'and bound the total work per character');
            const near = simulate(starB, text);

            api.assert.equal(near.matched, false, 'without the b it is an almost-match');
            api.assert.atMost(near.steps, 4 * 501,
              'and the almost-match costs the same as the match, which is the point');
          }
        }
      ]
    }],

    'text-processing': [{
      id: 'log-template-grouping',
      title: 'The template that has to be widened as it absorbs lines',
      prompt: 'templates(lines, threshold) must return an array of { tokens, count, lines }: the log ' +
        'templates extracted from `lines`, in the order the groups were created. Split each line on ' +
        'single spaces. A line can only join a group with the SAME token count; its similarity to ' +
        'that group\'s template is the fraction of positions where the tokens are equal OR the ' +
        'template already holds `<*>`. Put each line in the FIRST group scoring at least ' +
        '`threshold`, otherwise start a new group with the line as its template — and when a line ' +
        'joins, WIDEN the template: every position where the two disagree becomes `<*>`. The ' +
        'starter never widens, so the template stays the first line, later lines are compared ' +
        'against a literal that no longer represents the group, and no variable field is ever found.',
      entry: 'templates',
      starter: [
        'function templates(lines, threshold) {',
        '  const groups = [];',
        '',
        '  lines.forEach(function (line, index) {',
        '    const tokens = line.split(" ");',
        '    let joined = null;',
        '',
        '    groups.forEach(function (group) {',
        '      if (joined !== null || group.tokens.length !== tokens.length) return;',
        '      let same = 0;',
        '',
        '      for (let i = 0; i < tokens.length; i += 1) {',
        '        if (group.tokens[i] === "<*>" || group.tokens[i] === tokens[i]) same += 1;',
        '      }',
        '',
        '      if (same / tokens.length >= threshold) joined = group;',
        '    });',
        '',
        '    if (joined === null) {',
        '      groups.push({ tokens: tokens, count: 1, lines: [index] });',
        '      return;',
        '    }',
        '    // the line is absorbed, but the template is left as the first line',
        '    joined.count += 1;',
        '    joined.lines.push(index);',
        '  });',
        '  return groups;',
        '}'
      ].join('\n'),
      solution: [
        'function templates(lines, threshold) {',
        '  const groups = [];',
        '',
        '  lines.forEach(function (line, index) {',
        '    const tokens = line.split(" ");',
        '    let joined = null;',
        '',
        '    groups.forEach(function (group) {',
        '      if (joined !== null || group.tokens.length !== tokens.length) return;',
        '      let same = 0;',
        '',
        '      for (let i = 0; i < tokens.length; i += 1) {',
        '        if (group.tokens[i] === "<*>" || group.tokens[i] === tokens[i]) same += 1;',
        '      }',
        '',
        '      if (same / tokens.length >= threshold) joined = group;',
        '    });',
        '',
        '    if (joined === null) {',
        '      groups.push({ tokens: tokens, count: 1, lines: [index] });',
        '      return;',
        '    }',
        '',
        '    // widen: a position the group disagrees on IS a variable field',
        '    for (let i = 0; i < tokens.length; i += 1) {',
        '      if (joined.tokens[i] !== tokens[i]) joined.tokens[i] = "<*>";',
        '    }',
        '    joined.count += 1;',
        '    joined.lines.push(index);',
        '  });',
        '  return groups;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the wildcards land on the fields that varied',
          assert: function (templates, api) {
            const lines = [
              'GET /a 200 5ms',
              'GET /b 200 7ms',
              'GET /c 404 9ms',
              'POST /orders 201 3ms 1kb',
              'POST /orders 201 9ms 2kb'
            ];
            const got = templates(lines, 0.5);

            api.assert.equal(got.length, 2, 'two token counts, two templates');
            api.assert.deepEqual(got[0].tokens, ['GET', '<*>', '<*>', '<*>'],
              'path, status and duration all varied within the group');
            api.assert.deepEqual(got[0].lines, [0, 1, 2], 'and it covers the first three lines');
            api.assert.deepEqual(got[1].tokens, ['POST', '/orders', '201', '<*>', '<*>'],
              'the route and status held; the duration and size did not');
            api.assert.equal(got[1].count, 2, 'covering two lines');
          }
        },
        {
          name: 'both ends of the threshold are degenerate, and the algorithm is happy at both',
          assert: function (templates, api) {
            const lines = [
              'GET /a 200 5ms',
              'GET /b 200 7ms',
              'GET /c 404 9ms',
              'POST /orders 201 3ms 1kb',
              'POST /orders 201 9ms 2kb'
            ];
            const tight = templates(lines, 1);

            api.assert.equal(tight.length, 5, 'at 1.0 every distinct line is its own template');
            api.assert.deepEqual(tight[0].tokens, ['GET', '/a', '200', '5ms'],
              'and no template holds a wildcard');
            const loose = templates(lines, 0);

            api.assert.equal(loose.length, 2, 'at 0.0 only the token count separates lines');
            api.assert.deepEqual(loose[0].tokens, ['GET', '<*>', '<*>', '<*>'],
              'the four-token group keeps only what all three lines share');
          }
        },
        {
          name: 'every line is covered once, by a template that actually matches it',
          assert: function (templates, api) {
            const lines = [];

            for (let i = 0; i < 40; i += 1) {
              const verb = i % 3 === 0 ? 'GET' : 'POST';

              lines.push(verb + ' /r' + (i % 7) + ' ' + (200 + (i % 5)) + ' ' + i + 'ms');
            }
            const got = templates(lines, 0.5);
            let covered = 0;

            got.forEach(function (group) {
              api.assert.equal(group.count, group.lines.length, 'count and line list agree');
              covered += group.count;
              group.lines.forEach(function (index) {
                const tokens = lines[index].split(' ');

                api.assert.equal(tokens.length, group.tokens.length, 'same token count');

                for (let i = 0; i < tokens.length; i += 1) {
                  api.assert.ok(group.tokens[i] === '<*>' || group.tokens[i] === tokens[i],
                    'line ' + index + ' position ' + i + ' must match its own template');
                }
              });
            });
            api.assert.equal(covered, 40, 'all forty lines are covered exactly once');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

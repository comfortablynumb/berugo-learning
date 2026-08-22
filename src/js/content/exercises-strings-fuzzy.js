/**
 * Graded exercises for palindromes, approximate matching and diff (M15.7-M15.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'palindromes': [{
      id: 'manacher-mirror-cap',
      title: 'The mirror, and the minimum that everybody drops',
      prompt: 'manacher(text) must return { radii, longest, comparisons }. Interleave the text as ' +
        '`#a#b#c#` so that every palindrome is odd-length, then sweep left to right keeping the ' +
        'palindrome with the furthest right edge. At position i inside that palindrome, start from ' +
        'the radius already known at the mirror position `2 * centre − i` — but CAPPED at the ' +
        'distance to the right edge, because past that edge you have no information and must ' +
        'compare. `radii[i]` is the radius in the interleaved string, which is the length in the ' +
        'original. `longest` is `{ start, length }` in the ORIGINAL text and `comparisons` counts ' +
        'character equality tests. The starter copies the mirror uncapped: on "abab" it claims a ' +
        'radius of 3 at the last centre, a palindrome that runs off the end of the string.',
      entry: 'manacher',
      starter: [
        'function manacher(text) {',
        '  const t = "#" + text.split("").join("#") + "#";',
        '  const radii = new Array(t.length).fill(0);',
        '  let comparisons = 0;',
        '  let centre = 0;',
        '  let right = 0;',
        '',
        '  for (let i = 0; i < t.length; i += 1) {',
        '    let r = 0;',
        '',
        '    // the mirror, taken at face value',
        '    if (i < right) r = radii[2 * centre - i];',
        '',
        '    while (i - r - 1 >= 0 && i + r + 1 < t.length) {',
        '      comparisons += 1;',
        '      if (t[i - r - 1] !== t[i + r + 1]) break;',
        '      r += 1;',
        '    }',
        '    radii[i] = r;',
        '',
        '    if (i + r > right) { centre = i; right = i + r; }',
        '  }',
        '  let best = 0;',
        '',
        '  for (let i = 1; i < t.length; i += 1) {',
        '    if (radii[i] > radii[best]) best = i;',
        '  }',
        '  return {',
        '    radii: radii,',
        '    longest: { start: (best - radii[best]) / 2, length: radii[best] },',
        '    comparisons: comparisons',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function manacher(text) {',
        '  const t = "#" + text.split("").join("#") + "#";',
        '  const radii = new Array(t.length).fill(0);',
        '  let comparisons = 0;',
        '  let centre = 0;',
        '  let right = 0;',
        '',
        '  for (let i = 0; i < t.length; i += 1) {',
        '    let r = 0;',
        '',
        '    // never trust the mirror further than the right edge reaches',
        '    if (i < right) r = Math.min(right - i, radii[2 * centre - i]);',
        '',
        '    while (i - r - 1 >= 0 && i + r + 1 < t.length) {',
        '      comparisons += 1;',
        '      if (t[i - r - 1] !== t[i + r + 1]) break;',
        '      r += 1;',
        '    }',
        '    radii[i] = r;',
        '',
        '    if (i + r > right) { centre = i; right = i + r; }',
        '  }',
        '  let best = 0;',
        '',
        '  for (let i = 1; i < t.length; i += 1) {',
        '    if (radii[i] > radii[best]) best = i;',
        '  }',
        '  return {',
        '    radii: radii,',
        '    longest: { start: (best - radii[best]) / 2, length: radii[best] },',
        '    comparisons: comparisons',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every radius matches an exhaustive expansion, on "abab" and on "abacabadabacaba"',
          assert: function (manacher, api) {
            function reference(text) {
              const t = '#' + text.split('').join('#') + '#';
              const out = [];

              for (let i = 0; i < t.length; i += 1) {
                let r = 0;

                while (i - r - 1 >= 0 && i + r + 1 < t.length && t[i - r - 1] === t[i + r + 1]) {
                  r += 1;
                }
                out.push(r);
              }
              return out;
            }
            ['abab', 'abacabadabacaba', 'aabaa', 'aaaa', 'a', 'abcde'].forEach(function (text) {
              api.assert.deepEqual(manacher(text).radii, reference(text), 'radii for "' + text + '"');
            });
            const got = manacher('abab');

            api.assert.equal(got.longest.length, 3, '"abab" has a longest palindrome of 3');
            api.assert.atMost(got.longest.start + got.longest.length, 4,
              'the reported palindrome must fit inside the text');
          }
        },
        {
          name: 'the radii survive 40 random strings over two alphabets',
          assert: function (manacher, api) {
            function reference(text) {
              const t = '#' + text.split('').join('#') + '#';
              const out = [];

              for (let i = 0; i < t.length; i += 1) {
                let r = 0;

                while (i - r - 1 >= 0 && i + r + 1 < t.length && t[i - r - 1] === t[i + r + 1]) {
                  r += 1;
                }
                out.push(r);
              }
              return out;
            }

            for (let trial = 0; trial < 40; trial += 1) {
              const alphabet = trial % 2 === 0 ? 'ab' : 'abc';
              let text = '';

              for (let i = 0; i < 6 + api.rng.int(24); i += 1) {
                text += alphabet[api.rng.int(alphabet.length)];
              }
              api.assert.deepEqual(manacher(text).radii, reference(text),
                'trial ' + trial + ': "' + text + '"');
            }
          }
        },
        {
          name: 'the sweep stays linear on 300 identical characters',
          assert: function (manacher, api) {
            let text = '';

            for (let i = 0; i < 300; i += 1) text += 'a';
            const got = manacher(text);

            api.assert.equal(got.longest.length, 300, 'the whole string is a palindrome');
            api.assert.atMost(got.comparisons, 3 * (2 * 300 + 1),
              'expanding from scratch at every centre would cost about 90000 comparisons');
          }
        }
      ]
    }],

    'approximate-matching': [{
      id: 'banded-distance-refusal',
      title: 'The band, and the difference between a distance and a refusal',
      prompt: 'banded(a, b, k) must return { distance, exact, cells }: the edit distance between ' +
        '`a` and `b` computed only inside the diagonal band |i − j| <= k, since no cell outside it ' +
        'can hold a value of k or less. Cells outside the band count as k + 1. When the corner ' +
        'exceeds k the pair is a REFUSAL, not a measurement: return `distance: k + 1` and ' +
        '`exact: false`, because the true distance could be anything above the band. `cells` counts ' +
        'the DP cells you actually computed, row 0 included. The starter fills the whole grid and ' +
        'always claims the answer is exact — so it reports true distances above the band that a ' +
        'banded routine cannot have, and does the work the band exists to avoid.',
      entry: 'banded',
      starter: [
        'function banded(a, b, k) {',
        '  const n = a.length;',
        '  const m = b.length;',
        '  const infinite = k + 1;',
        '  let cells = 0;',
        '  let row = [];',
        '',
        '  for (let j = 0; j <= m; j += 1) { row[j] = j; cells += 1; }',
        '',
        '  for (let i = 1; i <= n; i += 1) {',
        '    const next = new Array(m + 1).fill(infinite);',
        '    next[0] = i;',
        '    cells += 1;',
        '',
        '    // the whole row, every time',
        '    for (let j = 1; j <= m; j += 1) {',
        '      cells += 1;',
        '      const swap = row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);',
        '      next[j] = Math.min(swap, row[j] + 1, next[j - 1] + 1);',
        '    }',
        '    row = next;',
        '  }',
        '  return { distance: row[m], exact: true, cells: cells };',
        '}'
      ].join('\n'),
      solution: [
        'function banded(a, b, k) {',
        '  const n = a.length;',
        '  const m = b.length;',
        '  const infinite = k + 1;',
        '  let cells = 0;',
        '',
        '  // a length gap wider than the band already costs more than k insertions',
        '  if (Math.abs(n - m) > k) return { distance: infinite, exact: false, cells: cells };',
        '  let row = new Array(m + 1).fill(infinite);',
        '',
        '  for (let j = 0; j <= Math.min(m, k); j += 1) { row[j] = j; cells += 1; }',
        '',
        '  for (let i = 1; i <= n; i += 1) {',
        '    const next = new Array(m + 1).fill(infinite);',
        '    const lo = Math.max(0, i - k);',
        '    const hi = Math.min(m, i + k);',
        '',
        '    for (let j = lo; j <= hi; j += 1) {',
        '      cells += 1;',
        '',
        '      if (j === 0) { next[0] = i <= k ? i : infinite; continue; }',
        '      const swap = row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);',
        '      const value = Math.min(swap, row[j] + 1, next[j - 1] + 1);',
        '      next[j] = value > infinite ? infinite : value;',
        '    }',
        '    row = next;',
        '  }',
        '  const distance = row[m];',
        '  return { distance: distance, exact: distance <= k, cells: cells };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'inside the band the distance matches a full dynamic program',
          assert: function (banded, api) {
            function reference(a, b) {
              let row = [];

              for (let j = 0; j <= b.length; j += 1) row[j] = j;

              for (let i = 1; i <= a.length; i += 1) {
                const next = [i];

                for (let j = 1; j <= b.length; j += 1) {
                  const swap = row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
                  next[j] = Math.min(swap, row[j] + 1, next[j - 1] + 1);
                }
                row = next;
              }
              return row[b.length];
            }

            for (let trial = 0; trial < 40; trial += 1) {
              const alphabet = 'abcd';
              let a = '';

              for (let i = 0; i < 8 + api.rng.int(10); i += 1) {
                a += alphabet[api.rng.int(alphabet.length)];
              }
              let b = a;

              for (let edit = 0; edit < api.rng.int(4); edit += 1) {
                const at = api.rng.int(b.length);

                b = b.slice(0, at) + alphabet[api.rng.int(alphabet.length)] + b.slice(at + 1);
              }
              const truth = reference(a, b);
              const got = banded(a, b, 3);

              if (truth > 3) continue;
              api.assert.equal(got.distance, truth, 'trial ' + trial + ': "' + a + '" vs "' + b + '"');
              api.assert.equal(got.exact, true, 'trial ' + trial + ': a distance of ' + truth + ' is inside the band');
            }
          }
        },
        {
          name: 'outside the band the answer is a refusal, not a number',
          assert: function (banded, api) {
            const got = banded('kitten', 'sitting', 1);

            api.assert.equal(got.exact, false, '"kitten" to "sitting" is 3 edits, which k = 1 cannot see');
            api.assert.equal(got.distance, 2, 'a refusal reports k + 1, never the true distance');
            const gap = banded('abcdefgh', 'ab', 2);

            api.assert.equal(gap.exact, false, 'a length gap of 6 cannot fit in a band of 2');
            api.assert.equal(gap.distance, 3, 'the refusal for k = 2 is 3');
            const inside = banded('kitten', 'sitting', 3);

            api.assert.equal(inside.exact, true, 'at k = 3 the same pair is measurable');
            api.assert.equal(inside.distance, 3, 'and the measurement is 3');
          }
        },
        {
          name: 'the band is actually narrow: 40 characters at k = 2 stays under the grid',
          assert: function (banded, api) {
            let a = '';

            for (let i = 0; i < 40; i += 1) a += 'abcd'[i % 4];
            const b = a.slice(0, 17) + 'z' + a.slice(18);
            const got = banded(a, b, 2);

            api.assert.equal(got.distance, 1, 'one substitution');
            api.assert.equal(got.exact, true, 'and it is inside the band');
            api.assert.atMost(got.cells, 41 * (2 * 2 + 2),
              'the full grid is 1681 cells; a band of 2 needs at most a quarter of that');
          }
        }
      ]
    }],

    'diff-and-merge': [{
      id: 'three-way-merge-slots',
      title: 'Two slots per line, and the conflict that is not one',
      prompt: 'merge(base, left, right) must return { lines, conflicts }. Each side is a list of ' +
        'changes `{ at, insert, replace }`: `insert` is the lines to add BEFORE `base[at]` (`at` may ' +
        'be `base.length` for a trailing block) and `replace` is the lines that stand in for ' +
        '`base[at]` — `null` when the line is untouched, `[]` when it is deleted. Walk the base once ' +
        'and resolve TWO INDEPENDENT SLOTS at every index: the insertion before the line, then the ' +
        'line itself. One side changed a slot, take it; both changed it the same way, take it once; ' +
        'both changed it differently, push `{ at, slot }` (slot is "insert" or "replace") onto ' +
        '`conflicts` and emit `<<<`, the left lines, `===`, the right lines, `>>>`. The starter keys ' +
        'one record per line, so an insertion on one side and an edit on the other look like a ' +
        'disagreement and conflict.',
      entry: 'merge',
      starter: [
        'function merge(base, left, right) {',
        '  const lines = [];',
        '  const conflicts = [];',
        '  const a = {};',
        '  const b = {};',
        '',
        '  left.forEach(function (change) { a[change.at] = change; });',
        '  right.forEach(function (change) { b[change.at] = change; });',
        '',
        '  for (let at = 0; at <= base.length; at += 1) {',
        '    const l = a[at];',
        '    const r = b[at];',
        '    let chosen = l || r || null;',
        '',
        '    // ONE slot per base line: any two changes here look like a disagreement',
        '    if (l && r && JSON.stringify(l) !== JSON.stringify(r)) {',
        '      conflicts.push({ at: at, slot: "line" });',
        '      chosen = l;',
        '    }',
        '',
        '    if (chosen && chosen.insert) {',
        '      chosen.insert.forEach(function (line) { lines.push(line); });',
        '    }',
        '',
        '    if (at === base.length) break;',
        '',
        '    if (chosen && chosen.replace) chosen.replace.forEach(function (line) { lines.push(line); });',
        '    else lines.push(base[at]);',
        '  }',
        '  return { lines: lines, conflicts: conflicts };',
        '}'
      ].join('\n'),
      solution: [
        'function merge(base, left, right) {',
        '  const lines = [];',
        '  const conflicts = [];',
        '',
        '  function indexBy(changes) {',
        '    const insert = {};',
        '    const replace = {};',
        '',
        '    changes.forEach(function (change) {',
        '      if (change.insert && change.insert.length) insert[change.at] = change.insert;',
        '      if (change.replace) replace[change.at] = change.replace;',
        '    });',
        '    return { insert: insert, replace: replace };',
        '  }',
        '',
        '  function resolve(at, slot, mine, theirs, untouched) {',
        '    if (mine === undefined && theirs === undefined) return untouched;',
        '    if (mine === undefined) return theirs;',
        '    if (theirs === undefined) return mine;',
        '    if (JSON.stringify(mine) === JSON.stringify(theirs)) return mine;',
        '    conflicts.push({ at: at, slot: slot });',
        '    return ["<<<"].concat(mine, ["==="], theirs, [">>>"]);',
        '  }',
        '  const a = indexBy(left);',
        '  const b = indexBy(right);',
        '',
        '  for (let at = 0; at <= base.length; at += 1) {',
        '    const before = resolve(at, "insert", a.insert[at], b.insert[at], []);',
        '',
        '    before.forEach(function (line) { lines.push(line); });',
        '',
        '    if (at === base.length) break;',
        '    const body = resolve(at, "replace", a.replace[at], b.replace[at], [base[at]]);',
        '',
        '    body.forEach(function (line) { lines.push(line); });',
        '  }',
        '  return { lines: lines, conflicts: conflicts };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an insertion beside an edit on the same line is not a conflict',
          assert: function (merge, api) {
            const base = ['one', 'two', 'three'];
            const left = [{ at: 1, insert: ['inserted'], replace: null }];
            const right = [{ at: 1, insert: [], replace: ['TWO'] }];
            const got = merge(base, left, right);

            api.assert.deepEqual(got.conflicts, [],
              'the insertion slot and the line slot are independent');
            api.assert.deepEqual(got.lines, ['one', 'inserted', 'TWO', 'three'],
              'both changes are taken, in base order');
          }
        },
        {
          name: 'four independent fixtures merge clean and the fifth conflicts',
          assert: function (merge, api) {
            const base = ['a', 'b', 'c', 'd'];
            const clean = [
              {
                why: 'different lines changed',
                left: [{ at: 0, insert: [], replace: ['A'] }],
                right: [{ at: 3, insert: [], replace: ['D'] }],
                lines: ['A', 'b', 'c', 'D']
              },
              {
                why: 'the same change made twice',
                left: [{ at: 2, insert: [], replace: ['C'] }],
                right: [{ at: 2, insert: [], replace: ['C'] }],
                lines: ['a', 'b', 'C', 'd']
              },
              {
                why: 'a deletion beside an edit',
                left: [{ at: 1, insert: [], replace: [] }],
                right: [{ at: 2, insert: [], replace: ['C'] }],
                lines: ['a', 'C', 'd']
              },
              {
                why: 'a trailing insertion',
                left: [{ at: 4, insert: ['e'], replace: null }],
                right: [{ at: 0, insert: ['zero'], replace: null }],
                lines: ['zero', 'a', 'b', 'c', 'd', 'e']
              }
            ];
            clean.forEach(function (fixture) {
              const got = merge(base, fixture.left, fixture.right);

              api.assert.deepEqual(got.conflicts, [], fixture.why + ': no conflict');
              api.assert.deepEqual(got.lines, fixture.lines, fixture.why + ': every edit lands, in base order');
            });
            const clash = merge(base,
              [{ at: 1, insert: [], replace: ['LEFT'] }],
              [{ at: 1, insert: [], replace: ['RIGHT'] }]);

            api.assert.deepEqual(clash.conflicts, [{ at: 1, slot: 'replace' }],
              'the same line changed two different ways is the one real conflict');
            api.assert.deepEqual(clash.lines,
              ['a', '<<<', 'LEFT', '===', 'RIGHT', '>>>', 'c', 'd'],
              'a conflict is reported, never resolved');
          }
        },
        {
          name: 'no changes reproduces the base exactly',
          assert: function (merge, api) {
            const base = [];

            for (let i = 0; i < 12; i += 1) base.push('line ' + i);
            const got = merge(base, [], []);

            api.assert.deepEqual(got.lines, base, 'an empty merge is the identity');
            api.assert.deepEqual(got.conflicts, [], 'and it conflicts nowhere');
            const one = merge(base, [{ at: 5, insert: ['x'], replace: [] }], []);

            api.assert.equal(one.lines.length, 12, 'one line replaced by one inserted line');
            api.assert.equal(one.lines[5], 'x', 'the insertion takes the deleted line\'s place');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));

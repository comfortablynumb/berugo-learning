'use strict';

/**
 * Property tests for the M15.7-M15.11 string modules: palindromes, approximate
 * matching, diff and merge, both regular-expression engines and the text
 * pipeline. Every claim is checked against a brute force, never against
 * itself.
 */

const test = require('node:test');
const assert = require('node:assert');

const Manacher = require('../../src/js/algorithms/manacher.js');
const Approximate = require('../../src/js/algorithms/approximate-match.js');
const Diff = require('../../src/js/algorithms/diff.js');
const Regex = require('../../src/js/algorithms/regex-engine.js');
const Pipeline = require('../../src/js/algorithms/text-pipeline.js');
const Random = require('../../src/js/utils/random.js');

/** The insertion-and-deletion distance, by the textbook table. */
function lcs(a, b) {
  let row = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    const next = [0];

    for (let j = 1; j <= b.length; j += 1) {
      next.push(a[i - 1] === b[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]));
    }
    row = next;
  }
  return row[b.length];
}

function words(seed, count, length, alphabet) {
  const rng = Random.seeded(seed);
  const out = [];

  for (let i = 0; i < count; i += 1) {
    let word = '';

    for (let j = 0; j < length; j += 1) word += alphabet[rng.int(alphabet.length)];
    out.push(word);
  }
  return out;
}

/* -------------------------------------------------------- 15.7 palindromes */

test('manacher: the radius array matches expansion around every centre', function () {
  ['abab', 'abacabadabacaba', 'aabaa', 'aaaa', 'a', 'abcde', '']
    .concat(words(31, 40, 18, 'ab'))
    .concat(words(32, 20, 12, 'abc'))
    .forEach(function (text) {
      const run = Manacher.palindromes(text, {});
      const truth = Manacher.palindromesByBruteForce(text);
      const key = function (entry) { return entry.start + ':' + entry.length; };
      const got = run.list.map(key).sort();

      assert.deepStrictEqual(got, truth.map(key).sort(),
        'the palindrome set differs on "' + text + '"');
    });
});

test('manacher: the substring count and the distinct count are different questions', function () {
  ['abacabadabacaba', 'aaaaaaaa', 'abcdef'].concat(words(33, 20, 14, 'ab'))
    .forEach(function (text) {
      assert.strictEqual(Manacher.countSubstrings(text), Manacher.countByBruteForce(text),
        'the substring count differs on "' + text + '"');
      const tree = Manacher.eertree(text, {});

      assert.strictEqual(tree.distinct, Manacher.distinctByBruteForce(text),
        'the distinct count differs on "' + text + '"');
      assert.ok(tree.nodes.length <= text.length + 2,
        'an eertree has at most n + 2 nodes, and this one has ' + tree.nodes.length);
    });
});

test('manacher: a run of one character separates the two counts by a factor of n', function () {
  [8, 20, 40].forEach(function (n) {
    let text = '';

    for (let i = 0; i < n; i += 1) text += 'a';
    assert.strictEqual(Manacher.countSubstrings(text), n * (n + 1) / 2,
      'every substring of a single-character run is a palindrome');
    assert.strictEqual(Manacher.eertree(text, {}).distinct, n,
      'and exactly n of them are distinct');
  });
});

test('manacher: the sweep stays linear where expansion does not', function () {
  let text = '';

  for (let i = 0; i < 400; i += 1) text += 'a';
  const run = Manacher.radii(text, {});

  assert.ok(run.report.comparisons <= 3 * (2 * 400 + 1),
    'the mirror keeps the comparisons linear, and this took ' + run.report.comparisons);
});

/* ------------------------------------------------ 15.8 approximate matching */

test('approximate-match: bitap at k = 0 finds exactly the exact occurrences', function () {
  const texts = words(34, 6, 300, 'abcd');
  const patterns = words(35, 6, 5, 'abcd');

  texts.forEach(function (text, i) {
    const pattern = patterns[i];
    const truth = [];

    for (let start = 0; start + pattern.length <= text.length; start += 1) {
      if (text.substr(start, pattern.length) !== pattern) continue;
      truth.push(start);
    }
    assert.deepStrictEqual(Approximate.bitapExact(text, pattern, {}).positions, truth,
      'bitap disagreed on "' + pattern + '"');
  });
});

test('approximate-match: Wu-Manber agrees with a dynamic program at every k', function () {
  const texts = words(36, 4, 400, 'abcd');
  const patterns = words(37, 4, 6, 'abcd');

  texts.forEach(function (text, i) {
    for (let k = 0; k <= 4; k += 1) {
      const fuzzy = Approximate.bitapFuzzy(text, patterns[i], k, {});
      const truth = Approximate.searchByDp(text, patterns[i], k, {});

      assert.deepStrictEqual(fuzzy.positions, truth.positions,
        'k = ' + k + ' disagreed on "' + patterns[i] + '"');
    }
  });
});

test('approximate-match: past the word size the answer is a refusal', function () {
  const text = words(38, 1, 200, 'abcd')[0];
  const long = words(39, 1, Approximate.WORD_BITS + 8, 'abcd')[0];
  const refused = Approximate.bitapFuzzy(text, long, 1, {});

  assert.strictEqual(refused.refused, true,
    'a pattern longer than ' + Approximate.WORD_BITS + ' bits cannot fit the register');
  assert.deepStrictEqual(refused.positions, [], 'and a refusal reports nothing');
  const fits = Approximate.bitapFuzzy(text, long.slice(0, Approximate.WORD_BITS), 1, {});

  assert.strictEqual(fits.refused, false, 'exactly at the word size it still works');
});

test('approximate-match: the band is exact inside k and a refusal outside it', function () {
  const left = words(40, 30, 9, 'abc');
  const right = words(41, 30, 9, 'abc');

  left.forEach(function (a, i) {
    const truth = Approximate.editDistance(a, right[i], {}).distance;

    [1, 2, 3].forEach(function (k) {
      const banded = Approximate.bandedDistance(a, right[i], k, {});

      if (truth <= k) {
        assert.strictEqual(banded.distance, truth,
          'inside the band the value must be the true distance');
        assert.strictEqual(banded.exact, true, 'and it must be flagged exact');
        return;
      }
      assert.strictEqual(banded.exact, false,
        'a distance of ' + truth + ' cannot be measured at k = ' + k);
      assert.strictEqual(banded.distance, k + 1, 'a refusal reports k + 1');
    });
  });
});

test('approximate-match: the q-gram filter is sound exactly while its threshold is positive', function () {
  const text = words(42, 1, 1200, 'abcde')[0];
  const pattern = words(43, 1, 6, 'abcde')[0];
  const k = 1;
  const unfiltered = Approximate.filteredSearch(text, pattern, k, { q: 5 }).positions;

  [2, 3, 4].forEach(function (q) {
    const rule = Approximate.qgramThreshold(pattern.length, q, k);
    const run = Approximate.filteredSearch(text, pattern, k, { q: q });

    assert.strictEqual(rule.usable, rule.threshold > 0,
      'usable is exactly "the threshold is positive"');
    assert.deepStrictEqual(run.positions, unfiltered,
      'q = ' + q + ' changed the answer, so the filter is not sound');

    if (rule.usable) {
      assert.ok(run.report.rejected > 0, 'a usable filter must actually reject something');
      return;
    }
    assert.strictEqual(run.report.rejected, 0,
      'an unusable filter must admit everything rather than pretend to filter');
  });
  unfiltered.forEach(function (start) {
    const window = text.substr(start, pattern.length + k);
    let best = k + 1;

    for (let length = Math.max(1, pattern.length - k); length <= window.length; length += 1) {
      const measured = Approximate.bandedDistance(window.slice(0, length), pattern, k, {});

      if (measured.exact) best = Math.min(best, measured.distance);
    }
    assert.ok(best <= k, 'position ' + start + ' was reported without an occurrence within k');
  });
});

/* --------------------------------------------------------- 15.9 diff/merge */

test('diff: every script applied to a reproduces b, and is as short as the distance', function () {
  for (let trial = 0; trial < 30; trial += 1) {
    const a = words(44 + trial, 1, 6, 'abcdef')[0].split('');
    const b = words(80 + trial, 1, 6, 'abcdef')[0].split('');
    const run = Diff.myers(a, b, {});

    assert.strictEqual(Diff.roundTrips(a, b, run.script).ok, true,
      'trial ' + trial + ': the script does not produce b');
    assert.strictEqual(run.script.filter(function (step) {
      return step.kind !== 'equal';
    }).length, run.distance, 'the operation count must equal the reported distance');
    assert.strictEqual(run.distance, a.length + b.length - 2 * lcs(a, b),
      'the script must be as short as n + m - 2 x LCS, which is the minimum');
  }
});

test('diff: patience round-trips too, and is never shorter than Myers', function () {
  for (let trial = 0; trial < 20; trial += 1) {
    const a = words(120 + trial, 8, 4, 'abc');
    const b = a.slice(0, 3).concat(words(160 + trial, 3, 4, 'abc'), a.slice(5));
    const myers = Diff.myers(a, b, {});
    const patience = Diff.patience(a, b, {});

    assert.strictEqual(Diff.roundTrips(a, b, patience.script).ok, true,
      'trial ' + trial + ': patience does not produce b');
    assert.ok(patience.distance >= myers.distance,
      'Myers is minimal, so nothing can be shorter');
  }
});

test('diff: an anchor occurs exactly once in each file', function () {
  const a = ['open', 'x', 'y', 'unique-a', 'x', 'close'];
  const b = ['open', 'x', 'unique-a', 'y', 'x', 'close'];
  const anchors = Diff.uniqueCommon(a, b, 0, a.length, 0, b.length);

  anchors.forEach(function (anchor) {
    const line = a[anchor.a];

    assert.strictEqual(a.filter(function (l) { return l === line; }).length, 1,
      '"' + line + '" is not unique in the first file');
    assert.strictEqual(b.filter(function (l) { return l === line; }).length, 1,
      '"' + line + '" is not unique in the second file');
  });
  const rising = Diff.longestIncreasing(anchors);

  for (let i = 1; i < rising.length; i += 1) {
    assert.ok(rising[i].a > rising[i - 1].a && rising[i].b > rising[i - 1].b,
      'the chosen anchors must rise in both files');
  }
});

test('diff: the merge conflicts only where both sides changed the same thing', function () {
  const base = ['a', 'b', 'c', 'd'];
  const cases = [
    { why: 'different lines', left: ['A', 'b', 'c', 'd'], right: ['a', 'b', 'c', 'D'], conflicts: 0 },
    { why: 'the same change twice', left: ['a', 'b', 'C', 'd'], right: ['a', 'b', 'C', 'd'], conflicts: 0 },
    { why: 'an insertion beside an edit', left: ['a', 'new', 'b', 'c', 'd'], right: ['a', 'B', 'c', 'd'], conflicts: 0 },
    { why: 'a deletion beside an edit', left: ['a', 'c', 'd'], right: ['a', 'b', 'C', 'd'], conflicts: 0 },
    { why: 'both sides, one line, two ways', left: ['a', 'L', 'c', 'd'], right: ['a', 'R', 'c', 'd'], conflicts: 1 }
  ];

  cases.forEach(function (item) {
    const run = Diff.merge(base, item.left, item.right);

    assert.strictEqual(run.conflicts.length, item.conflicts, item.why);
  });
});

/* ------------------------------------------------------------- 15.10 regex */

test('regex: the two engines accept the same strings', function () {
  const fixtures = [
    ['abc', 'abc'], ['abc', 'abd'], ['a*', ''], ['a*', 'aaa'], ['a|b', 'b'],
    ['(a|b)*abb', 'aababb'], ['(a|b)*abb', 'aabab'], ['a.c', 'axc'],
    ['a+b', 'aaab'], ['a+b', 'b'], ['(ab)+', 'ababab'], ['a?b', 'b'],
    ['(a+)+b', 'aaab'], ['(a*)*b', 'b'], ['(a|a)*b', 'aab']
  ];

  fixtures.forEach(function (row) {
    const verdict = Regex.compare(row[0], row[1], {});

    assert.strictEqual(verdict.agree, true,
      '"' + row[0] + '" on "' + row[1] + '": backtracking said ' + verdict.backtrackMatched +
      ' and the simulation said ' + verdict.nfaMatched);
  });
});

test('regex: the state set is bounded by the machine, whatever the input', function () {
  for (let n = 6; n <= 20; n += 2) {
    const built = Regex.pathological(n);
    const verdict = Regex.compare(built.pattern, built.text, {});

    assert.ok(verdict.setSizePeak <= verdict.nfaStates,
      'the set grew past the machine at n = ' + n);
    assert.ok(verdict.nfaSteps <= 2 * verdict.nfaStates * (built.text.length + 1),
      'the simulation cost more than the set plus its closure at n = ' + n);
  }
});

test('regex: the backtracking cost grows and the simulation cost does not', function () {
  const small = Regex.compare(Regex.pathological(8).pattern, Regex.pathological(8).text, {});
  const large = Regex.compare(Regex.pathological(16).pattern, Regex.pathological(16).text, {});

  assert.ok(large.backtrackSteps >= 64 * small.backtrackSteps,
    'eight more characters must cost at least 2^8 times as much backtracking');
  assert.ok(large.nfaSteps < 3 * small.nfaSteps,
    'while the simulation grows with the input length only');
});

test('regex: an unambiguous pattern is flat on both engines', function () {
  const short = Regex.compare('a*b', 'aaaaaaaaaaaa', {});
  const long = Regex.compare('a*b', 'aaaaaaaaaaaaaaaaaaaa', {});

  assert.strictEqual(short.backtrackMatched, false, 'no b, so no match');
  assert.ok(long.backtrackSteps < 3 * short.backtrackSteps,
    'without nesting there is nothing to re-explore');
  assert.strictEqual(long.exhausted, false, 'and no budget is exhausted');
});

/* ---------------------------------------------------- 15.11 text pipeline */

test('text-pipeline: more merges means a bigger vocabulary and fewer tokens', function () {
  const text = words(200, 40, 8, 'abcde').join(' ');
  let previousTokens = Infinity;
  let previousVocabulary = 0;

  [0, 10, 30, 60].forEach(function (merges) {
    const run = Pipeline.bytePairEncoding(text, { merges: merges });

    assert.ok(run.tokens <= previousTokens, 'the token count cannot rise with more merges');
    assert.ok(run.vocabulary.size >= previousVocabulary, 'nor can the vocabulary fall');
    previousTokens = run.tokens;
    previousVocabulary = run.vocabulary.size;
  });
});

test('text-pipeline: the rule-based tokeniser never produces fewer tokens', function () {
  ['POST /api/login 401 33ms', 'GET /a/b/c 200 1ms', 'user-1234 catherine'].forEach(function (line) {
    assert.ok(Pipeline.ruleBased(line).length >= Pipeline.whitespace(line).length,
      'splitting further cannot merge tokens: "' + line + '"');
  });
});

test('text-pipeline: a template matches every line it covers', function () {
  const lines = [];

  for (let i = 0; i < 60; i += 1) {
    lines.push((i % 3 === 0 ? 'GET' : 'POST') + ' /r' + (i % 7) + ' ' + (200 + (i % 5)) +
      ' ' + i + 'ms');
  }
  const run = Pipeline.extractTemplates(lines, { threshold: 0.5 });
  let covered = 0;

  run.templates.forEach(function (entry) {
    covered += entry.count;
    entry.tokens.forEach(function (token) {
      assert.ok(typeof token === 'string', 'every template position is a token or a wildcard');
    });
  });
  assert.strictEqual(covered, lines.length, 'every line belongs to exactly one template');
});

test('text-pipeline: the threshold moves the template count monotonically', function () {
  const lines = [];

  for (let i = 0; i < 90; i += 1) {
    lines.push('GET /r' + (i % 9) + ' ' + (200 + (i % 4)) + ' ' + i + 'ms');
  }
  let previous = 0;

  [0.2, 0.4, 0.6, 0.8, 1].forEach(function (threshold) {
    const run = Pipeline.extractTemplates(lines, { threshold: threshold });

    assert.ok(run.templates.length >= previous,
      'a stricter threshold cannot produce fewer templates');
    previous = run.templates.length;
  });
});

test('text-pipeline: blocking changes the cost and not the answer', function () {
  const records = [];

  for (let i = 0; i < 120; i += 1) records.push('record ' + i + ' name');
  records.push('Jon Smyth');
  records.push('John Smith');
  const blocked = Pipeline.namePipeline('John Smith', records, {});
  const plain = Pipeline.namePipeline('John Smith', records, { block: false });

  assert.deepStrictEqual(blocked.matches.map(function (m) { return m.record; }),
    plain.matches.map(function (m) { return m.record; }),
    'a sound filter cannot change which records come back');
  assert.ok(blocked.report.candidates < plain.report.candidates,
    'and it must reduce the candidate count to be worth having');
  assert.strictEqual(plain.selectivity, 1, 'without blocking every record is a candidate');
});

test('text-pipeline: no metric here is right on every pair', function () {
  const pairs = [
    { a: 'Jon Smyth', b: 'John Smith', match: true },
    { a: 'service-a', b: 'service-b', match: false },
    { a: 'Elizabeth Windsor', b: 'Windsor Elizabeth', match: true },
    { a: 'user-1234', b: 'user-1235', match: false }
  ];
  const metrics = {
    levenshtein: function (a, b) { return Pipeline.levenshteinRatio(a, b); },
    jaroWinkler: function (a, b) { return Pipeline.jaroWinkler(a, b, {}); },
    jaccard: function (a, b) { return Pipeline.jaccard(Pipeline.shingles(a, 2), Pipeline.shingles(b, 2)); }
  };

  Object.keys(metrics).forEach(function (name) {
    let worstMatch = 1;
    let bestNonMatch = 0;

    pairs.forEach(function (pair) {
      const value = metrics[name](Pipeline.normalise(pair.a), Pipeline.normalise(pair.b));

      if (pair.match) worstMatch = Math.min(worstMatch, value);
      else bestNonMatch = Math.max(bestNonMatch, value);
    });
    assert.ok(bestNonMatch >= worstMatch,
      name + ' would separate these pairs with a single cutoff, which no metric here does');
  });
});

'use strict';

/**
 * The prose scanner reads the orientation and insight strings back out of a
 * section's source, because they are arguments inside an IIFE and there is no
 * way to ask for them without booting a DOM. A scanner that quietly returns
 * the wrong text would report a flattering sentence count over the whole
 * curriculum, so the parts that can go wrong are pinned here: brackets and
 * commas inside string literals, concatenation across lines, escaped quotes,
 * and the sentence split.
 */

const test = require('node:test');
const assert = require('node:assert');

const scan = require('../../tools/prose-scan.js');

test('valueAt stops at the comma that ends the value', function () {
  const source = 'insight: \'one\', demo: 2';
  assert.strictEqual(scan.valueAt(source, 'insight:'.length).trim(), "'one'");
});

test('valueAt is not ended by a bracket or comma inside a string', function () {
  const source = "orientation: ['a, b [c]'], next: 1";
  const value = scan.valueAt(source, 'orientation:'.length);

  assert.deepStrictEqual(scan.stringsIn(value), ['a, b [c]']);
});

test('valueAt spans a nested array', function () {
  const source = "definition: ['a', ['b', 'c']], caption: 'd'";
  const value = scan.valueAt(source, 'definition:'.length);

  assert.deepStrictEqual(scan.stringsIn(value), ['a', 'b', 'c']);
});

test('adjacent literals joined by + are one paragraph', function () {
  const source = "['first half ' +\n  'second half', 'other']";

  assert.deepStrictEqual(scan.stringsIn(source), ['first half second half', 'other']);
});

test('an escaped quote stays inside its literal', function () {
  assert.deepStrictEqual(scan.stringsIn("['it\\'s one']"), ["it's one"]);
});

test('paragraphsOf accepts a string or an array', function () {
  assert.deepStrictEqual(scan.paragraphsOf('one'), ['one']);
  assert.deepStrictEqual(scan.paragraphsOf(['one', 'two']), ['one', 'two']);
  assert.deepStrictEqual(scan.paragraphsOf(null), []);
});

test('sentences split on a full stop before a capital', function () {
  assert.deepStrictEqual(scan.sentences('One thing. Then another.'),
    ['One thing.', 'Then another.']);
});

test('sentences split before a bold markdown lead', function () {
  const text = 'Two rules cover it. **Sum with Kahan** when the count is large.';

  assert.strictEqual(scan.sentences(text).length, 2);
});

test('a full stop inside a bold thesis still ends the sentence', function () {
  const text = '**A buffer is bytes.** Once that is concrete the rest is ordinary.';

  assert.strictEqual(scan.sentences(text).length, 2);
});

test('a sentence may start with a capital that is not ASCII', function () {
  const text = 'O(g) caps from above. Ω(g) floors from below. Θ(g) claims both.';

  assert.strictEqual(scan.sentences(text).length, 3);
});

test('a decimal point does not end a sentence', function () {
  assert.strictEqual(scan.sentences('The ratio is 1.5 at most.').length, 1);
});

test('wordCount ignores repeated whitespace', function () {
  assert.strictEqual(scan.wordCount('  three  words here '), 3);
});

test('an orientation lifted into its own function is still scanned', function () {
  const source = [
    '(function (root) {',
    '  function orientation() {',
    '    return [',
    "      'First paragraph.',",
    "      'Second ' +",
    "        'paragraph.'",
    '    ];',
    '  }',
    '',
    '  function config() {',
    '    return { orientation: orientation(), insight: \'Closing line.\' };',
    '  }',
    '}(window));'
  ].join('\n');

  assert.deepStrictEqual(scan.proseFor(source, 'orientation'),
    ['First paragraph.', 'Second paragraph.']);
  assert.deepStrictEqual(scan.proseFor(source, 'insight'), ['Closing line.']);
});

test('an inline orientation array is preferred over any function of that name', function () {
  const source = [
    '  function config() {',
    '    return {',
    '      orientation: [',
    "        'Inline paragraph.'",
    '      ]',
    '    };',
    '  }'
  ].join('\n');

  assert.deepStrictEqual(scan.proseFor(source, 'orientation'), ['Inline paragraph.']);
});

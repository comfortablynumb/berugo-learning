'use strict';

/**
 * The orientation extractor rewrites a section file mechanically, so the parts
 * that could silently corrupt one are pinned: a bracket inside a string must
 * not end the array, the moved block must keep its own indentation, and the
 * call must land where the array was.
 */

const test = require('node:test');
const assert = require('node:assert');

const tool = require('../../tools/extract-orientation.js');

const SECTION = [
  '(function (root) {',
  '',
  '  function config() {',
  '    return {',
  '      sectionId: SECTION_ID,',
  '      orientation: [',
  "        'first [bracketed] paragraph',",
  "        'second paragraph'",
  '      ],',
  "      insight: 'done'",
  '    };',
  '  }',
  '}(window));',
  ''
].join('\n');

test('the array is replaced by a call to the new function', function () {
  const out = tool.extract(SECTION);

  assert.match(out, /orientation: orientation\(\),/);
  assert.match(out, /function orientation\(\) \{/);
});

test('the moved block keeps both paragraphs and loses two spaces of indent', function () {
  const out = tool.extract(SECTION);

  assert.match(out, /\n      'first \[bracketed\] paragraph',\n/);
  assert.match(out, /\n      'second paragraph'\n    \];\n/);
});

test('the new function is placed before the one that held the array', function () {
  const out = tool.extract(SECTION);

  assert.ok(out.indexOf('function orientation()') < out.indexOf('function config()'));
});

test('a bracket inside a string does not end the array', function () {
  const source = "(function (root) {\n  function config() {\n    return {\n      orientation: [\n        'a ] b'\n      ],\n      x: 1\n    };\n  }\n}(window));\n";
  const out = tool.extract(source);

  assert.match(out, /orientation: orientation\(\),/);
  assert.match(out, /'a \] b'/);
});

test('a file with no orientation array is refused rather than mangled', function () {
  assert.throws(function () { tool.extract('  function config() { return {}; }\n'); },
    /no orientation array/);
});

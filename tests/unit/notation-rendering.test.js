'use strict';

/**
 * The decoder has to reach every tab, not just the Description tab.
 *
 * The glossary and its annotator were always correct; for a long time they were
 * simply not called from two of the three tabs. Concepts decoded their symbols
 * and the worked examples - the block with the densest arithmetic on the
 * platform - rendered `n·log₂n ≤ c·n²` with nothing to hover. The cost table in
 * the References tab, which is almost entirely notation, was bare too.
 *
 * These tests are the guard on that. For each block they compute the symbols
 * the glossary can find in the *annotated* fields, render the block, and
 * require every one of them to appear as a chip. A field added later and piped
 * through `esc` instead of the annotator fails here rather than shipping.
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const NotationMarkup = require('../../src/js/utils/notation-markup.js');
const SectionExamples = require('../../src/js/components/section-examples.js');
const SectionReference = require('../../src/js/components/section-reference.js');
const CodeLab = require('../../src/js/components/code-lab.js');
const registries = require('../../src/js/content/registries.js');

const CONTENT_DIR = path.join(__dirname, '..', '..', 'src', 'js', 'content');
fs.readdirSync(CONTENT_DIR)
  .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
  .forEach(function (file) { require(path.join(CONTENT_DIR, file)); });

/* The two columns the reference renderer deliberately leaves bare: both are
   already a definition - "α — the load factor" - and a chip there would only
   repeat the meaning sitting beside it. */
const NOT_ANNOTATED = ['sym', 'system'];

function collect(value, out, skip) {
  if (typeof value === 'string') { out.push(value); return out; }
  if (Array.isArray(value)) {
    value.forEach(function (item) { collect(item, out, skip); });
    return out;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (key) {
      if (skip && skip.indexOf(key) !== -1) return;
      if (typeof value[key] === 'function') return;
      collect(value[key], out, skip);
    });
  }
  return out;
}

/** The symbols the glossary would decode in these strings, for this section. */
function symbolsIn(strings, sectionId) {
  const mark = NotationMarkup.createAnnotator({ sectionId: sectionId });
  strings.forEach(function (text) { mark.annotate(text); });
  return mark.decoded();
}

/** The tokens actually chipped in a rendered block. */
function chipsIn(html) {
  const found = new Set();
  const pattern = /<abbr class="notation"[^>]*>([^<]*)<\/abbr>/g;
  let match = pattern.exec(html);

  while (match !== null) {
    found.add(decodeEntities(match[1]));
    match = pattern.exec(html);
  }
  return found;
}

function decodeEntities(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Runs one block over every section: gather the symbols its annotated fields
 * contain, render it, and report any that came out undecoded.
 */
function auditBlock(spec) {
  const gaps = [];

  spec.registry.ids().forEach(function (id) {
    const entry = spec.registry.get(id);
    if (!entry) return;

    const expected = symbolsIn(spec.strings(entry), id);
    if (!expected.length) return;

    const chipped = chipsIn(spec.render(entry, id));
    const missing = expected.filter(function (token) { return !chipped.has(token); });
    if (missing.length) gaps.push(id + ': ' + missing.join(' '));
  });
  return gaps;
}

test('notation: the worked examples decode every symbol they use', function () {
  const gaps = auditBlock({
    registry: registries.ExampleRegistry,
    strings: function (entry) { return collect(entry, [], null); },
    render: function (entry, id) { return SectionExamples.markup(entry, { sectionId: id }); }
  });

  assert.deepStrictEqual(gaps, [],
    'these sections show notation in a worked example that the reader cannot ' +
    'decode in place:\n  ' + gaps.join('\n  '));
});

test('notation: the reference block decodes every symbol it uses', function () {
  const gaps = auditBlock({
    registry: registries.ReferenceRegistry,
    strings: function (entry) { return collect(entry, [], NOT_ANNOTATED); },
    render: function (entry, id) { return SectionReference.markup(entry, { sectionId: id }); }
  });

  assert.deepStrictEqual(gaps, [],
    'these sections show notation in the reference block - usually the cost ' +
    'table - with nothing to hover:\n  ' + gaps.join('\n  '));
});

test('notation: an exercise prompt decodes the symbols it states the task in', function () {
  const gaps = [];

  registries.ExerciseRegistry.ids().forEach(function (id) {
    (registries.ExerciseRegistry.get(id) || []).forEach(function (exercise) {
      const expected = symbolsIn([exercise.title, exercise.prompt].filter(Boolean), id);
      if (!expected.length) return;

      const chipped = chipsIn(CodeLab.markup(exercise, { sectionId: id }));
      const missing = expected.filter(function (token) { return !chipped.has(token); });
      if (missing.length) gaps.push(id + ' / ' + exercise.id + ': ' + missing.join(' '));
    });
  });

  assert.deepStrictEqual(gaps, [],
    'these prompts state the task in notation the lab does not decode:\n  ' +
    gaps.join('\n  '));
});

test('notation: the dense blocks are the ones that carry chips', function () {
  const id = 'asymptotic-notation';
  const examples = SectionExamples.markup(registries.ExampleRegistry.get(id), { sectionId: id });
  const reference = SectionReference.markup(registries.ReferenceRegistry.get(id), { sectionId: id });

  assert.match(examples, /class="step-work">[^]*?<abbr class="notation"/,
    'the arithmetic block of a worked example carries no chip');
  assert.match(reference, /<td class="mono">[^]*?<abbr class="notation"/,
    'the cost table carries no chip');
});

test('notation: a learner code sample is never mistaken for notation', function () {
  const exercise = {
    id: 'x', title: 'T', prompt: 'Return o(n) work.',
    starter: 'function f(o) { return o(1); }',
    solution: 'const lim = 2; const mod = 3;'
  };
  const html = CodeLab.markup(exercise, { sectionId: 'asymptotic-notation' });

  assert.ok(html.indexOf('<abbr class="notation"') !== -1, 'the prompt should decode o(n)');
  assert.strictEqual(html.indexOf(exercise.starter), -1,
    'the starter is written into the editor by mount(), never into the markup');
  assert.strictEqual(html.indexOf('lim'), -1, 'the solution is not rendered as prose');
});

test('notation: annotating a block still escapes the content', function () {
  const html = SectionExamples.markup([{
    title: '<script>alert(1)</script>',
    steps: [{ do: 'a & b', why: 'w', work: 'Θ(n) <b>', result: 'r' }],
    answer: '"quoted"'
  }], { sectionId: 'asymptotic-notation' });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a &amp; b/);
  assert.match(html, /&lt;b&gt;/);
});

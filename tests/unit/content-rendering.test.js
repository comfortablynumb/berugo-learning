'use strict';

/**
 * Content that was written must reach the page.
 *
 * Two defects motivated this file, and both were invisible to every other
 * check. `inTheWild` is written in two shapes - `{ system, how }` in most
 * sections and a single sentence in 122 others - and the renderer only read
 * the first, so 488 entries rendered as `<li><span class="sym"></span> — </li>`:
 * a bullet with nothing in it. Separately, `sources[].note` says what a source
 * is good for, and 623 of them were written and none rendered.
 *
 * Neither showed up in the render audit, which boots every section and checks
 * that nothing throws and no *table* is empty. An empty list item is not an
 * empty table, and a field that is never read is not an error.
 *
 * So the contract here is blunt: take a distinctive phrase out of every string
 * the content registries hold, render the block, and require the phrase to be
 * in the text a learner would see. Comparing a whole string would fail on the
 * notation chips, which is why the phrase is a plain-prose run.
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const SectionExamples = require('../../src/js/components/section-examples.js');
const SectionReference = require('../../src/js/components/section-reference.js');
const registries = require('../../src/js/content/registries.js');

const CONTENT_DIR = path.join(__dirname, '..', '..', 'src', 'js', 'content');
fs.readdirSync(CONTENT_DIR)
  .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
  .forEach(function (file) { require(path.join(CONTENT_DIR, file)); });

/** The rendered markup as a learner reads it: tags dropped, entities restored. */
function visibleText(html) {
  return html.replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/**
 * The longest run of ordinary prose in a string - letters, digits and spaces.
 * Notation is annotated in place, so a run containing a symbol may be split by
 * a chip; a plain run never is, and is what this test can safely look for.
 */
function longestPlainRun(text) {
  const runs = String(text).match(/[A-Za-z][A-Za-z0-9 ]{15,}/g);
  if (!runs) return '';
  return runs.reduce(function (best, run) {
    return run.length > best.length ? run : best;
  }, '');
}

function everyString(value, out) {
  if (typeof value === 'string') { out.push(value); return out; }
  if (Array.isArray(value)) {
    value.forEach(function (item) { everyString(item, out); });
    return out;
  }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (key) {
      if (typeof value[key] !== 'function') everyString(value[key], out);
    });
  }
  return out;
}

function auditReaches(registry, render) {
  const dropped = [];

  registry.ids().forEach(function (id) {
    const entry = registry.get(id);
    if (!entry) return;

    const shown = visibleText(render(entry, id));
    everyString(entry, []).forEach(function (text) {
      const phrase = longestPlainRun(text);
      if (!phrase) return;
      if (shown.indexOf(phrase.replace(/\s+/g, ' ')) !== -1) return;
      dropped.push(id + ': "' + phrase.trim().slice(0, 60) + '"');
    });
  });
  return dropped;
}

test('content: every string in a reference entry reaches the page', function () {
  const dropped = auditReaches(registries.ReferenceRegistry, function (entry, id) {
    return SectionReference.markup(entry, { sectionId: id });
  });

  assert.deepStrictEqual(dropped, [],
    'this reference content was written and is never rendered:\n  ' + dropped.join('\n  '));
});

test('content: every string in a worked example reaches the page', function () {
  const dropped = auditReaches(registries.ExampleRegistry, function (entry, id) {
    return SectionExamples.markup(entry, { sectionId: id });
  });

  assert.deepStrictEqual(dropped, [],
    'this worked-example content was written and is never rendered:\n  ' + dropped.join('\n  '));
});

test('content: no reference list item renders empty', function () {
  const empties = [];

  registries.ReferenceRegistry.ids().forEach(function (id) {
    const html = SectionReference.markup(registries.ReferenceRegistry.get(id), { sectionId: id });
    const items = html.match(/<li[^>]*>[\s\S]*?<\/li>/g) || [];

    items.forEach(function (item) {
      if (visibleText(item).replace(/[—·\s]/g, '') === '') empties.push(id + ': ' + item);
    });
  });

  assert.deepStrictEqual(empties, [],
    'these list items render as a bullet with nothing in it:\n  ' + empties.join('\n  '));
});

test('content: both shapes of an "in the wild" entry render their sentence', function () {
  const asObject = SectionReference.markup({
    inTheWild: [{ system: 'Postgres', how: 'uses this for index-only scans' }]
  }, { sectionId: 'x' });
  const asString = SectionReference.markup({
    inTheWild: ['Postgres uses this for index-only scans.']
  }, { sectionId: 'x' });

  assert.match(visibleText(asObject), /Postgres — uses this for index-only scans/);
  assert.match(visibleText(asString), /Postgres uses this for index-only scans\./);
  assert.doesNotMatch(visibleText(asString), /undefined/);
});

test('content: an equation renders the sentence that reads it out loud', function () {
  const html = SectionReference.markup({
    formulation: {
      equations: [{
        label: 'Model checking',
        expr: 'the system satisfies the property ⟺ L(system) ∩ L(¬property) = ∅',
        readAs: 'Build a machine accepting exactly the behaviours that violate the property.',
        terms: [{ sym: '∅', meaning: 'the empty set' }]
      }]
    }
  }, { sectionId: 'x' });

  assert.match(html, /class="reads-as"/, 'the equation reading is not rendered');
  assert.match(visibleText(html), /Build a machine accepting exactly the behaviours/);
  assert.ok(html.indexOf('class="reads-as"') > html.indexOf('class="equation"'),
    'the reading has to sit under the notation it decodes, not above it');
});

test('content: every equation that has a reading shows it', function () {
  const missing = [];

  registries.ReferenceRegistry.ids().forEach(function (id) {
    const entry = registries.ReferenceRegistry.get(id);
    const list = (entry && entry.formulation && entry.formulation.equations) || [];
    if (!list.some(function (eq) { return eq.readAs; })) return;

    const shown = visibleText(SectionReference.markup(entry, { sectionId: id }));
    list.filter(function (eq) { return eq.readAs; }).forEach(function (eq) {
      const phrase = longestPlainRun(eq.readAs);
      if (phrase && shown.indexOf(phrase) === -1) missing.push(id + ': ' + eq.label);
    });
  });

  assert.deepStrictEqual(missing, [],
    'these equations carry a plain-English reading that never reaches the page:\n  ' +
    missing.join('\n  '));
});

test('content: a source renders its title, its locator and what it is good for', function () {
  const html = SectionReference.markup({
    sources: [{ title: 'Sipser', where: 'ch. 3', note: 'the clearest statement of the theorem' }]
  }, { sectionId: 'x' });

  const shown = visibleText(html);
  assert.match(shown, /Sipser/);
  assert.match(shown, /ch\. 3/);
  assert.match(shown, /the clearest statement of the theorem/);
});

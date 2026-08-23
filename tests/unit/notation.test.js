'use strict';

/**
 * The notation glossary and the annotator that applies it.
 *
 * The suite that matters most here is the last one: it walks every string the
 * content registries hold, collects the mathematical characters, and fails if
 * any of them has no glossary entry. That is what stops the decoder rotting -
 * a milestone that introduces a new symbol has to explain it in the same
 * commit, rather than shipping a chip that never appears.
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const Notation = require('../../src/js/content/notation.js');
const NotationMarkup = require('../../src/js/utils/notation-markup.js');
const NotationPanel = require('../../src/js/components/notation-panel.js');
const registries = require('../../src/js/content/registries.js');

const CONTENT_DIR = path.join(__dirname, '..', '..', 'src', 'js', 'content');
fs.readdirSync(CONTENT_DIR)
  .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
  .forEach(function (file) { require(path.join(CONTENT_DIR, file)); });

/* Typographic characters and accented names are not notation: an em dash in a
   sentence and a c-caron in "Cormen" need no explanation. Everything else that
   is not plain ASCII is a symbol a reader may not be able to say out loud. */
const TYPOGRAPHY = /[\u2014\u2013\u2026\u2018\u2019\u201C\u201D\u00A7\u2713\u2717\u00A0]/u;

function isProse(ch) {
  if (ch.codePointAt(0) < 128) return true;
  if (TYPOGRAPHY.test(ch)) return true;
  return /\p{Script=Latin}|\p{M}/u.test(ch);
}

test('notation: every entry says how to read it and what it does', function () {
  const seen = new Set();
  Notation.tokens().forEach(function (token) {
    const entry = Notation.entry(token);
    assert.ok(entry, 'no entry for ' + token);
    assert.ok(entry.reads && entry.reads.length > 1, token + ' has no reading');
    assert.ok(entry.means && entry.means.length >= 20, token + ' has no meaning');
    assert.ok(!seen.has(token), 'duplicate glossary token ' + token);
    seen.add(token);
  });
  assert.ok(seen.size >= 60, 'expected a real glossary, found ' + seen.size + ' entries');
});

test('notation: the longest token wins, so log base two is not a stray subscript', function () {
  const mark = NotationMarkup.createAnnotator({});
  const html = mark.annotate('log₂ n');
  assert.match(html, /aria-label="log₂:/);
  assert.doesNotMatch(html, /aria-label="₂:/);
});

test('notation: big-O is decoded only where it is notation', function () {
  assert.match(NotationMarkup.annotate('costs O(n log n)'), /aria-label="O:/);
  assert.doesNotMatch(NotationMarkup.annotate('an OK result for OAuth'), /aria-label="O:/);
  assert.doesNotMatch(NotationMarkup.annotate('foo(bar)'), /aria-label="o:/);
});

test('notation: annotation escapes, so content still cannot inject markup', function () {
  const html = NotationMarkup.annotate('<script>alert(1)</script> & Θ');
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp;/);
});

test('notation: a repeated symbol is decoded once per block, not nine times', function () {
  const mark = NotationMarkup.createAnnotator({});
  const html = mark.annotate('Θ(n) and Θ(n²) and Θ(n³)');
  assert.strictEqual(html.match(/aria-label="Θ:/g).length, 1);
  assert.deepStrictEqual(mark.decoded().sort(), ['²', '³', 'Θ']);
});

test('notation: the formal line asks for all of it and gets all of it', function () {
  const mark = NotationMarkup.createAnnotator({});
  const html = mark.annotate('n₀ ≤ n₀ ≤ n₀', { all: true });
  assert.strictEqual(html.match(/aria-label="₀:/g).length, 3);
});

test('notation: a section can pin a letter to the meaning it uses', function () {
  Notation.registerLocal('open-addressing', {
    'α': { means: 'The load factor: entries divided by slots. At 0.9 a linear probe walks ten slots.' }
  });

  const local = Notation.entry('α', 'open-addressing');
  const global = Notation.entry('α');
  assert.match(local.means, /load factor: entries divided by slots/);
  assert.strictEqual(local.reads, 'alpha', 'an override keeps the reading it did not replace');
  assert.notStrictEqual(global.means, local.means, 'the override is scoped to its section');
});

test('notation: a chip carries both a hover panel and an accessible name', function () {
  const html = NotationMarkup.annotate('√n');
  assert.match(html, /class="notation"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /data-note="the square root of/);
  assert.match(html, /aria-label="√: the square root of/);
});

test('notation: placement is a no-op where there is no geometry to measure', function () {
  assert.strictEqual(NotationPanel.place(null), 0);
  assert.strictEqual(NotationPanel.place({}), 0);
  assert.strictEqual(NotationPanel.place({ querySelectorAll: function () { return []; } }), 0);
});

test('notation: a chip with no room to its right hangs its panel from the right', function () {
  const flags = [];

  function fakeChip(left) {
    return {
      getBoundingClientRect: function () { return { left: left, width: 10, right: left + 10 }; },
      classList: { toggle: function (name, on) { flags.push({ name: name, on: on }); } }
    };
  }

  const chips = [fakeChip(20), fakeChip(900)];
  const container = {
    getBoundingClientRect: function () { return { left: 0, width: 960, right: 960 }; },
    querySelectorAll: function () { return chips; }
  };

  assert.strictEqual(NotationPanel.place(container), 1);
  assert.deepStrictEqual(flags.map(function (f) { return f.on; }), [false, true]);
  assert.strictEqual(flags[0].name, NotationPanel.endClass);
});

/* The guard. Everything the curriculum registers, walked for symbols. */
function collectStrings(value, out) {
  if (typeof value === 'string') { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach(function (item) { collectStrings(item, out); }); return out; }
  if (value && typeof value === 'object') {
    Object.keys(value).forEach(function (key) { collectStrings(value[key], out); });
  }
  return out;
}

function everyRegisteredString() {
  const out = [];
  [registries.ConceptRegistry, registries.ExampleRegistry,
    registries.ReferenceRegistry, registries.ExerciseRegistry].forEach(function (registry) {
    registry.ids().forEach(function (id) { collectStrings(registry.get(id), out); });
  });
  return out;
}

test('notation: every mathematical character in the curriculum is in the glossary', function () {
  const missing = new Map();

  everyRegisteredString().forEach(function (text) {
    for (const ch of text) {
      if (isProse(ch) || Notation.entry(ch)) continue;
      missing.set(ch, (missing.get(ch) || 0) + 1);
    }
  });

  const report = Array.from(missing.entries()).map(function (pair) {
    return pair[0] + ' (U+' + pair[0].codePointAt(0).toString(16).toUpperCase() +
      ', used ' + pair[1] + ' times)';
  });

  assert.deepStrictEqual(report, [],
    'these symbols appear in the content with no glossary entry, so a learner ' +
    'meeting them cold has nowhere to go:\n  ' + report.join('\n  '));
});

/* Every formal line a non-mathematical reader cannot say out loud must carry a
   reading. "Cannot say out loud" is the HARD set below: quantifiers, set
   operators, sums and products, ceilings and floors, norms, Greek variables,
   subscripted indices, argmin/argmax, expectations, factorials and the named
   functions ln, lim and mod. A line whose notation is only an O(...) or a ≤
   inside an English sentence is already readable, and adding a reading there
   would be noise rather than help - so the floor is this set, not all of it. */
const HARD = new RegExp(
  '[∀∃⟺⟹⇒⇔⇏∈∉⊆⊇⊊∪∩∖∅⋃∧∨¬⊥ΣΠ⌈⌉⌊⌋‖√∝≡≪≫⊕αβγδεθλμσρτφχΦΔΩΘ₀₁₂₃₄₅ₙₘᵢⱼ]' +
  '|argmin|argmax|\bE\[|\bmod\b|\bln\b|\blim\b|[0-9)][!](?![=])', 'u');

test('notation: a formal line a reader cannot say out loud carries its reading', function () {
  const missing = [];

  registries.ConceptRegistry.ids().forEach(function (id) {
    (registries.ConceptRegistry.get(id) || []).forEach(function (concept) {
      if (!HARD.test(concept.formal || '')) return;
      if (concept.readAs) return;
      missing.push(id + ' :: ' + concept.term);
    });
  });

  assert.deepStrictEqual(missing, [],
    'these formal lines use notation a reader without a maths background cannot ' +
    'pronounce, and carry no readAs to translate it:\n  ' + missing.join('\n  '));
});

test('notation: a reading explains rather than restating the symbols', function () {
  const tooShort = [];

  registries.ConceptRegistry.ids().forEach(function (id) {
    (registries.ConceptRegistry.get(id) || []).forEach(function (concept) {
      if (!concept.readAs) return;
      const text = String(concept.readAs);
      if (text.length < 80) tooShort.push(id + ' :: ' + concept.term + ' (' + text.length + ')');
      assert.ok(/[.!?]$/.test(text.trim()),
        'the reading for "' + concept.term + '" is a truncated sentence');
    });
  });

  assert.deepStrictEqual(tooShort, [],
    'a reading shorter than a sentence is a restatement, not a translation:\n  ' +
    tooShort.join('\n  '));
});

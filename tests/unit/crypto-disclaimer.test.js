'use strict';

/**
 * M23 ships working implementations of primitives that must never protect real
 * data, so the milestone's acceptance criterion is that the standing disclaimer
 * renders on EVERY one of its sections — not on the first one, and not only in
 * a source comment.
 *
 * Three things are checked, because each can rot independently: the template
 * emits a warning callout with a disclaimer id, the controller writes a
 * module's DISCLAIMER into it, and the section's own orientation opens with the
 * warning so a learner reading the Description tab meets it before any code.
 */

const test = require('node:test');
const assert = require('node:assert');

const fs = require('node:fs');
const path = require('node:path');

const Curriculum = require('../../src/js/core/curriculum.js');

const SECTIONS = path.join(__dirname, '..', '..', 'src', 'js', 'sections');
const ALGORITHMS = path.join(__dirname, '..', '..', 'src', 'js', 'algorithms');
const MODULES = ['crypto-hash.js', 'block-cipher.js', 'aead.js', 'public-key.js',
  'signatures.js', 'kdf.js', 'constant-time.js', 'threshold.js', 'ratchet.js'];

function milestoneSections(id) {
  const found = [];

  Curriculum.tracks().forEach(function (track) {
    (track.groups || []).forEach(function (group) {
      if (group.id !== id) return;
      (group.sections || []).forEach(function (section) { found.push(section.id); });
    });
  });
  return found;
}

function read(file) {
  return fs.readFileSync(path.join(SECTIONS, file), 'utf8');
}

/** The DISCLAIMER a module actually exports, rather than its source text. */
function disclaimerOf(modulePath) {
  return require(modulePath).DISCLAIMER;
}

const crypto = milestoneSections('M23');

test('crypto: M23 has its full set of sections', function () {
  assert.strictEqual(crypto.length, 11,
    'M23 ships eleven sections, found ' + crypto.length + ': ' + crypto.join(', '));
});

crypto.forEach(function (id) {
  test('crypto: ' + id + ' renders the standing disclaimer', function () {
    const template = read(id + '-template.js');
    const controller = read(id + '-section.js');
    const match = template.match(/id="([a-z]+-disclaimer)"/);

    assert.ok(match, id + ' has no element with a disclaimer id in its template');
    assert.match(template, /class="callout callout-warning"/,
      id + ' does not render the disclaimer as a warning callout');
    assert.ok(controller.indexOf('setText(\'' + match[1] + '\'') !== -1,
      id + ' never writes anything into #' + match[1]);
    assert.match(controller, /DISCLAIMER/,
      id + ' does not use a module DISCLAIMER, so the wording can drift');
  });

  test('crypto: ' + id + ' opens its orientation with the warning', function () {
    const controller = read(id + '-section.js');
    const orientation = controller.match(/function orientation\(\) \{[\s\S]*?\n  \}/);

    assert.ok(orientation, id + ' has no orientation function');
    const first = orientation[0].split('\'')[1] || '';

    assert.match(first, /^\*\*⚠/,
      id + ' does not begin its orientation with the warning bullet: "' + first.slice(0, 40) + '"');
  });
});

test('crypto: every teaching module carries a standing disclaimer', function () {
  MODULES.forEach(function (file) {
    const text = disclaimerOf(path.join(ALGORITHMS, file));

    assert.ok(text, file + ' declares no DISCLAIMER');
    assert.match(text, /^Teaching implementation:/,
      file + ' does not open its disclaimer with "Teaching implementation:"');
    /* Each module names the weakness that is actually its own — a toy curve is
       a more honest warning for public-key.js than "not constant time" is. */
    assert.match(text, /constant.time|toy parameters|toy curve|table-driven|breakable by design/,
      file + ' does not name what is wrong with it: "' + text + '"');
    assert.match(text, /never for real data|not this code/,
      file + ' does not forbid real data: "' + text + '"');
  });
});

test('crypto: the lab’s disclaimer names the audited alternative', function () {
  const text = disclaimerOf(
    path.join(__dirname, '..', '..', 'src', 'js', 'machines', 'crypto-lab.js'));

  assert.ok(text, 'crypto-lab.js declares no DISCLAIMER');
  assert.match(text, /must never protect real data/,
    'the lab must forbid real data in the words the sections render');
  assert.match(text, /crypto\.subtle, libsodium or an equivalent audited library/,
    'and must point at the audited alternative');
});

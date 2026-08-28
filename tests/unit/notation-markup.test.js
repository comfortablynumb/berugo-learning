'use strict';

/**
 * The annotator, and the inline markup the orientation and insight prose is
 * written in.
 *
 * `**` for the claim a paragraph is making and backticks for an identifier
 * were escaped and shown to the learner raw for the whole life of the project —
 * 204 of 306 sections were affected — because the only annotator was the
 * notation one, which escapes everything it does not recognise as a symbol.
 * These tests pin both halves: the markup renders, and the two places that
 * must NOT get it still do not.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const Markup = require(path.join(__dirname, '..', '..', 'src', 'js', 'utils',
  'notation-markup.js'));

test('markup: bold becomes strong and backticks become code', function () {
  assert.strictEqual(Markup.annotateRich('**a claim.** and the rest'),
    '<strong>a claim.</strong> and the rest');
  assert.strictEqual(Markup.annotateRich('call `makeRecord` first'),
    'call <code>makeRecord</code> first');
});

test('markup: code inside bold survives, because bold is split first', function () {
  assert.strictEqual(Markup.annotateRich('**a call to `f` allocates.** yes'),
    '<strong>a call to <code>f</code> allocates.</strong> yes');
});

test('markup: everything is still escaped', function () {
  assert.strictEqual(Markup.annotateRich('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
  assert.strictEqual(Markup.annotateRich('**<script>**'),
    '<strong>&lt;script&gt;</strong>');
  assert.strictEqual(Markup.annotateRich('`<img onerror=x>`'),
    '<code>&lt;img onerror=x&gt;</code>');
});

test('markup: an unclosed marker is left alone rather than guessed at', function () {
  assert.strictEqual(Markup.annotateRich('an unclosed ** marker'), 'an unclosed ** marker');
  assert.strictEqual(Markup.annotateRich('an unclosed ` tick'), 'an unclosed ` tick');
});

test('markup: notation is still decoded, including inside a bold span', function () {
  const plain = Markup.annotateRich('Θ appears here');
  const bolded = Markup.annotateRich('**Θ appears here**');

  assert.ok(plain.indexOf('<abbr class="notation"') !== -1, 'a bare symbol is chipped');
  assert.ok(bolded.indexOf('<abbr class="notation"') !== -1,
    'and so is one inside a bold claim');
  assert.ok(bolded.indexOf('<strong>') === 0);
});

test('markup: a symbol inside a code span is an identifier, not notation', function () {
  const out = Markup.annotateRich('`Θ(n)`');

  assert.strictEqual(out, '<code>Θ(n)</code>');
});

test('markup: annotate itself is unchanged, because content uses ** as a power',
  function () {
    /* `2**53` appears in the M01 content as exponentiation. Rendering it as
       bold would corrupt it, which is why the rich renderer is a separate
       entry point used only by the two blocks whose authors write markdown. */
    assert.strictEqual(Markup.annotate('2**53 + 1'), '2**53 + 1');
    assert.strictEqual(Markup.annotate('call `f`'), 'call `f`');
  });

/* The end-to-end check - that no section leaves a raw marker in its rendered
   orientation or insight - lives in `tests/render-audit.js`, which boots the
   real app and can read the real DOM. A scan of the source cannot do it: the
   prose is assembled by concatenating string fragments, so a pair of markers
   routinely straddles two literals and an apostrophe inside a comment
   desynchronises any attempt to find the literals. */

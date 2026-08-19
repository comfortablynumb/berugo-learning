'use strict';

/**
 * The two halves of a worked-example figure test, shared so every topic states
 * them the same way.
 *
 * A figure test is only worth writing if it does both things: recompute the
 * number from the module, and assert the *prose still quotes it*. `quotes`
 * is the second half. It searches the concatenation of every worked example
 * and every concept for a section, so a number may live in a step, in an
 * answer or in a concept's `example` line and still be found - moving it
 * between them is a rewrite, not a regression.
 *
 * The caller must `require` the content files it needs before calling; the
 * registries are populated by that require, not by this module.
 */

const assert = require('node:assert');
const registries = require('../../src/js/content/registries.js');

function stepText(step) {
  return [step.do, step.why, step.work, step.result].filter(Boolean).join(' ');
}

function exampleText(example) {
  return [example.title, example.goal, example.setup, example.answer]
    .filter(Boolean)
    .concat(example.steps.map(stepText))
    .join(' ');
}

function conceptText(concept) {
  const detail = Array.isArray(concept.detail) ? concept.detail.join(' ') : concept.detail;
  return [concept.plain, concept.formal, detail, concept.example].filter(Boolean).join(' ');
}

/** Every word of teaching prose a section carries, as one string. */
function proseFor(sectionId) {
  const examples = registries.ExampleRegistry.get(sectionId) || [];
  const concepts = registries.ConceptRegistry.get(sectionId) || [];
  return examples.map(exampleText).concat(concepts.map(conceptText)).join(' ');
}

/** Asserts the section's prose still quotes each figure. */
function quotes(sectionId, figures) {
  const body = proseFor(sectionId);
  const list = Array.isArray(figures) ? figures : [figures];
  list.forEach(function (figure) {
    assert.ok(body.indexOf(figure) !== -1,
      'the ' + sectionId + ' content no longer quotes "' + figure + '"');
  });
}

function fixed(value, digits) {
  return Number(value).toFixed(digits === undefined ? 2 : digits);
}

/**
 * Thousands separators in the prose are plain spaces - "5 504 000" - because
 * that is what `utils/format.js` renders. The tests quote the same rendering.
 */
function grouped(value) {
  return Math.round(value).toLocaleString('en-US').replace(/,/g, ' ');
}

module.exports = { proseFor: proseFor, quotes: quotes, fixed: fixed, grouped: grouped };

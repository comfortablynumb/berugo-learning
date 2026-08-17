'use strict';

/**
 * Content coverage: the floor every teaching section must clear.
 *
 * This is the test that keeps the curriculum honest as it grows. A section can
 * be added to curriculum.js and wired up, but until it carries concepts, two
 * worked examples with real arithmetic, a reference entry with its invariants,
 * failure modes and sources, and at least one graded exercise, this suite
 * fails.
 *
 * Two worked examples rather than one is deliberate: the first derives the
 * result, the second is the case that inverts it - the load factor where the
 * clever layout loses, the workload where the better deletion ranks last.
 *
 * Every concept must also carry `detail`: the Description tab is the first
 * thing a learner sees, and a one-line gloss there is a definition rather than
 * an explanation. The floor is a real paragraph, and it may not simply repeat
 * the plain statement.
 */

const test = require('node:test');
const assert = require('node:assert');

const Curriculum = require('../../src/js/core/curriculum.js');
const registries = require('../../src/js/content/registries.js');

const fs = require('node:fs');
const path = require('node:path');

/* Load every content module, so a new milestone's content is covered by these
   tests the moment it lands - no test edit required, which is the point. */
const CONTENT_DIR = path.join(__dirname, '..', '..', 'src', 'js', 'content');
fs.readdirSync(CONTENT_DIR)
  .filter(function (file) { return file.endsWith('.js') && file !== 'registries.js'; })
  .forEach(function (file) { require(path.join(CONTENT_DIR, file)); });

const MINIMUMS = {
  concepts: 6,
  conceptDetail: 240,
  examples: 2,
  exampleSteps: 3,
  exercises: 1,
  exerciseTests: 2,
  invariants: 2,
  failureModes: 3,
  sources: 3
};

const teaching = Curriculum.teachingSections();

/** `detail` is one paragraph or several; both are checked as one body of text. */
function detailText(detail) {
  if (!detail) return '';
  return (Array.isArray(detail) ? detail.join(' ') : detail);
}

test('there is at least one teaching section to check', function () {
  assert.ok(teaching.length > 0);
});

teaching.forEach(function (section) {
  test('content: ' + section.id + ' carries concepts', function () {
    const concepts = registries.ConceptRegistry.get(section.id);
    assert.ok(concepts, 'no concepts registered');
    assert.ok(concepts.length >= MINIMUMS.concepts,
      'expected at least ' + MINIMUMS.concepts + ' concepts, found ' + concepts.length);

    concepts.forEach(function (concept) {
      assert.ok(concept.term, 'term');
      assert.ok(concept.plain, 'plain statement for ' + concept.term);
      assert.ok(concept.formal, 'formal statement for ' + concept.term);
      assert.ok(concept.example, 'example for ' + concept.term);
    });
  });

  test('content: ' + section.id + ' explains every concept, not just names it', function () {
    const concepts = registries.ConceptRegistry.get(section.id) || [];

    concepts.forEach(function (concept) {
      const detail = detailText(concept.detail);
      assert.ok(detail, 'no detail paragraph for "' + concept.term + '"');
      assert.ok(detail.length >= MINIMUMS.conceptDetail,
        'the detail for "' + concept.term + '" is ' + detail.length + ' characters; the floor is ' +
        MINIMUMS.conceptDetail);
      assert.notStrictEqual(detail, concept.plain,
        'the detail for "' + concept.term + '" repeats the plain statement');
      assert.ok(/[.!?]$/.test(detail.trim()),
        'the detail for "' + concept.term + '" is a truncated sentence');
    });
  });

  test('content: ' + section.id + ' carries worked examples with arithmetic', function () {
    const examples = registries.ExampleRegistry.get(section.id);
    assert.ok(examples, 'no worked examples registered');
    assert.ok(examples.length >= MINIMUMS.examples);

    examples.forEach(function (example) {
      assert.ok(example.title && example.goal && example.setup, 'header fields');
      assert.ok(example.steps.length >= MINIMUMS.exampleSteps,
        'expected at least ' + MINIMUMS.exampleSteps + ' steps in "' + example.title + '"');
      assert.ok(example.answer, 'a stated answer');

      example.steps.forEach(function (step, i) {
        assert.ok(step.do, 'step ' + (i + 1) + ' says what to do');
        assert.ok(step.why, 'step ' + (i + 1) + ' says why');
        assert.ok(step.work, 'step ' + (i + 1) + ' shows the work');
        assert.ok(/[0-9]/.test(step.work), 'step ' + (i + 1) + ' work contains real numbers');
      });
    });
  });

  test('content: ' + section.id + ' carries a complete reference entry', function () {
    const entry = registries.ReferenceRegistry.get(section.id);
    assert.ok(entry, 'no reference entry registered');

    ['summary', 'intuition', 'formulation', 'invariants', 'complexity', 'failureModes',
      'inTheWild', 'sources'].forEach(function (field) {
      assert.ok(entry[field], 'missing ' + field);
    });

    assert.ok(entry.formulation.equations.length >= 1, 'at least one equation');
    assert.ok(entry.invariants.length >= MINIMUMS.invariants,
      'expected at least ' + MINIMUMS.invariants + ' invariants, found ' + entry.invariants.length);
    assert.ok(entry.failureModes.length >= MINIMUMS.failureModes,
      'expected at least ' + MINIMUMS.failureModes + ' failure modes, found ' + entry.failureModes.length);
    assert.ok(entry.sources.length >= MINIMUMS.sources,
      'expected at least ' + MINIMUMS.sources + ' sources, found ' + entry.sources.length);

    entry.failureModes.forEach(function (mode) {
      assert.ok(mode.symptom && mode.cause && mode.fix, 'a failure mode names symptom, cause and fix');
    });

    entry.complexity.forEach(function (row) {
      assert.ok(row.operation && row.average && row.worst, 'a cost row names the operation and both cases');
    });
  });

  test('content: ' + section.id + ' carries graded exercises', function () {
    const exercises = registries.ExerciseRegistry.get(section.id);
    assert.ok(exercises, 'no exercises registered');
    assert.ok(exercises.length >= MINIMUMS.exercises);

    exercises.forEach(function (exercise) {
      assert.ok(exercise.id && exercise.title && exercise.prompt, 'header fields');
      assert.ok(exercise.entry, 'an entry function name');
      assert.ok(exercise.starter, 'starter code');
      assert.ok(exercise.solution, 'a reference solution');
      assert.ok(exercise.tests.length >= MINIMUMS.exerciseTests,
        'expected at least ' + MINIMUMS.exerciseTests + ' tests in ' + exercise.id);

      exercise.tests.forEach(function (spec) {
        assert.ok(spec.name, 'each test is named');
        assert.strictEqual(typeof spec.assert, 'function');
      });
    });
  });
});

test('content: no registry holds an entry for an unknown section', function () {
  const known = new Set(Curriculum.sections().map(function (section) { return section.id; }));
  [registries.ConceptRegistry, registries.ExampleRegistry,
    registries.ReferenceRegistry, registries.ExerciseRegistry].forEach(function (registry) {
    registry.ids().forEach(function (id) {
      assert.ok(known.has(id), registry.name + ' has an entry for unknown section "' + id + '"');
    });
  });
});

test('content: exercise ids are unique within a section', function () {
  teaching.forEach(function (section) {
    const ids = (registries.ExerciseRegistry.get(section.id) || []).map(function (e) { return e.id; });
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate exercise id in ' + section.id);
  });
});

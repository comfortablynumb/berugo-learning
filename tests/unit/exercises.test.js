'use strict';

/**
 * Every graded exercise is run twice, through the real sandbox:
 *
 *   - the reference solution must pass every test, or the exercise is
 *     impossible and the learner will be right to be angry;
 *   - the starter must fail at least one test, or the exercise is vacuous and
 *     passes before it is attempted.
 *
 * Exercises whose starter fails only by exceeding a wall-clock budget declare
 * `starterFailure: 'timeout'`: the inline sandbox used here enforces no
 * timeout, so running that starter would take minutes and prove nothing.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sandbox = require('../../src/js/core/sandbox.js');
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

function runExercise(exercise, code) {
  return Sandbox.execute({
    code: code,
    entry: exercise.entry,
    mode: 'grade',
    seed: exercise.seed || 1,
    opsLimit: exercise.opsLimit,
    tests: exercise.tests.map(function (spec) {
      return { name: spec.name, src: String(spec.assert) };
    })
  }, function () {});
}

function describeFailures(result) {
  return result.tests
    .filter(function (t) { return !t.passed; })
    .map(function (t) { return t.name + ' — ' + t.message; })
    .join('\n    ');
}

Curriculum.teachingSections().forEach(function (section) {
  (registries.ExerciseRegistry.get(section.id) || []).forEach(function (exercise) {
    const label = section.id + '/' + exercise.id;

    test('exercise ' + label + ': the reference solution passes every test', function () {
      const result = runExercise(exercise, exercise.solution);

      assert.strictEqual(result.stage, 'complete', 'stage was ' + result.stage +
        (result.error ? ' (' + result.error.message + ')' : ''));
      assert.strictEqual(result.ok, true, 'failing tests:\n    ' + describeFailures(result));
      assert.strictEqual(result.passedCount, exercise.tests.length);
    });

    test('exercise ' + label + ': the starter does not already pass', function (t) {
      if (exercise.starterFailure === 'timeout') {
        t.skip('starter fails by exceeding the wall-clock budget, which the inline sandbox cannot enforce');
        return;
      }

      const result = runExercise(exercise, exercise.starter);
      assert.strictEqual(result.ok, false, 'the starter passes every test, so the exercise is vacuous');
    });

    test('exercise ' + label + ': tests are self-contained', function () {
      exercise.tests.forEach(function (spec) {
        const source = String(spec.assert);
        assert.doesNotThrow(function () {
          /* eslint-disable-next-line no-new-func */
          new Function('return (' + source + ');')();
        }, 'test "' + spec.name + '" cannot be rebuilt from its source');
      });
    });
  });
});

test('exercises: a deliberately wrong solution is caught by the tests', function () {
  const exercise = (registries.ExerciseRegistry.get('js-systems') || [])
    .find(function (e) { return e.id === 'hash-combine'; });

  assert.ok(exercise, 'the hash-combine exercise exists');

  // XOR is the classic wrong answer: it is order-insensitive, so the order
  // test must reject it. If this ever passes, that test has stopped working.
  const wrong = 'function combine(a, b) { return (a ^ b) >>> 0; }';
  const result = runExercise(exercise, wrong);

  assert.strictEqual(result.ok, false);
  const failed = result.tests.filter(function (t) { return !t.passed; }).map(function (t) { return t.name; });
  assert.ok(failed.some(function (name) { return /order matters/.test(name); }),
    'the order-sensitivity test must be the one that fails, got: ' + failed.join(', '));
});

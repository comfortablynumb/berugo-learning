/**
 * Assertions for graded exercises.
 *
 * These run inside the sandbox, against the learner's function. Every failure
 * carries the expected and actual values, because "expected 42, got 41" is a
 * hint and "assertion failed" is not.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Assert = api;
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function () {
  'use strict';

  function AssertionError(message) {
    const error = new Error(message);
    error.name = 'AssertionError';
    return error;
  }

  function show(value) {
    if (typeof value === 'string') return JSON.stringify(value);
    if (Array.isArray(value)) {
      const head = value.slice(0, 12).map(show).join(', ');
      return '[' + head + (value.length > 12 ? ', …+' + (value.length - 12) : '') + ']';
    }
    if (value && typeof value === 'object') {
      try { return JSON.stringify(value); } catch (error) { return String(value); }
    }
    return String(value);
  }

  function ok(value, message) {
    if (value) return;
    throw AssertionError(message || 'expected a truthy value, got ' + show(value));
  }

  function equal(actual, expected, message) {
    if (Object.is(actual, expected)) return;
    throw AssertionError((message ? message + ': ' : '') + 'expected ' + show(expected) + ', got ' + show(actual));
  }

  function notEqual(actual, unexpected, message) {
    if (!Object.is(actual, unexpected)) return;
    throw AssertionError((message ? message + ': ' : '') + 'expected a value other than ' + show(unexpected));
  }

  function deepEqual(actual, expected, message) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a === b) return;
    throw AssertionError((message ? message + ': ' : '') + 'expected ' + show(expected) + ', got ' + show(actual));
  }

  function closeTo(actual, expected, tolerance, message) {
    const limit = tolerance === undefined ? 1e-9 : tolerance;
    if (Number.isFinite(actual) && Math.abs(actual - expected) <= limit) return;
    throw AssertionError((message ? message + ': ' : '') +
      'expected ' + show(expected) + ' ± ' + limit + ', got ' + show(actual));
  }

  function atMost(actual, limit, message) {
    if (actual <= limit) return;
    throw AssertionError((message ? message + ': ' : '') + 'expected at most ' + show(limit) + ', got ' + show(actual));
  }

  function atLeast(actual, limit, message) {
    if (actual >= limit) return;
    throw AssertionError((message ? message + ': ' : '') + 'expected at least ' + show(limit) + ', got ' + show(actual));
  }

  function throwsError(fn, message) {
    try {
      fn();
    } catch (error) {
      return error;
    }
    throw AssertionError(message || 'expected the call to throw, and it returned normally');
  }

  return {
    ok: ok,
    equal: equal,
    notEqual: notEqual,
    deepEqual: deepEqual,
    closeTo: closeTo,
    atMost: atMost,
    atLeast: atLeast,
    throws: throwsError,
    show: show
  };
}));

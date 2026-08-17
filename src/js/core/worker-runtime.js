/**
 * Worker runtime.
 *
 * Loaded as a real worker script (not a Blob) so it stays debuggable and
 * relative importScripts paths resolve. It is deliberately thin: everything
 * that decides semantics lives in sandbox.js, which the inline backend also
 * uses, so the two backends cannot drift.
 */
/* global importScripts, Sandbox */
'use strict';

importScripts('../utils/random.js', '../utils/assert.js', '../utils/ops-counter.js', 'sandbox.js');

self.onmessage = function (event) {
  const message = event.data || {};

  if (message.type === 'ping') {
    self.postMessage({ type: 'pong', id: message.id });
    return;
  }

  if (message.type !== 'run') {
    self.postMessage({ type: 'error', id: message.id, error: { name: 'BadMessage', message: 'unknown message type' } });
    return;
  }

  const emit = function (payload) {
    self.postMessage(Object.assign({ id: message.id }, payload));
  };

  let result;
  try {
    result = Sandbox.execute(message.request || {}, emit);
  } catch (error) {
    result = {
      ok: false,
      stage: 'worker',
      error: { name: error.name || 'Error', message: error.message || String(error), stack: '' },
      tests: [],
      logs: [],
      metrics: {},
      durationMs: 0
    };
  }

  self.postMessage({ type: 'done', id: message.id, result: result });
};

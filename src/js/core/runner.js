/**
 * Runner - the only way code gets executed.
 *
 * `Runner` is an interface with two backends that speak the identical message
 * protocol:
 *   WorkerBackend  the default. A real worker per run slot, a wall-clock
 *                  watchdog, and `terminate()` as the only reliable way to
 *                  stop a `while (true) {}`.
 *   InlineBackend  the test double and the last-resort fallback. Same results,
 *                  but it runs in the host realm: no timeout enforcement and no
 *                  isolation, only shadowed globals. It says both in
 *                  `result.warnings`, because a fallback that quietly weakens a
 *                  guarantee is worse than one that refuses to run.
 *
 * Host -> backend: { type: 'run', id, request }
 * backend -> host: { type: 'log' | 'test' | 'metric' | 'done' | 'error', id, ... }
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.createRunner = api.createRunner;
    root.createWorkerBackend = api.createWorkerBackend;
    root.createInlineBackend = api.createInlineBackend;
  }
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const DEFAULT_TIMEOUT = 2000;

  function resolveSandbox(host) {
    if (host && host.Sandbox) return host.Sandbox;
    if (typeof require === 'function') return require('./sandbox.js');
    throw new Error('Runner: Sandbox must be loaded first');
  }

  function createInlineBackend(options) {
    const settings = options || {};
    const sandbox = settings.sandbox || resolveSandbox(scope);

    return {
      name: 'inline',
      enforcesTimeout: false,
      run: function (request, onMessage) {
        return new Promise(function (resolve) {
          const result = sandbox.execute(request, onMessage);
          result.warnings = [
            'inline backend: no wall-clock timeout is enforced',
            'inline backend: runs in the host realm — host globals are shadowed, not removed'
          ];
          resolve(result);
        });
      },
      dispose: function () {}
    };
  }

  function createWorkerBackend(options) {
    const settings = options || {};
    const url = settings.url || 'src/js/core/worker-runtime.js';
    const WorkerCtor = settings.Worker || (typeof Worker !== 'undefined' ? Worker : null);
    if (!WorkerCtor) throw new Error('Runner: Worker is not available in this environment');

    let worker = null;
    let sequence = 0;

    function ensure() {
      if (!worker) worker = new WorkerCtor(url);
      return worker;
    }

    function kill() {
      if (!worker) return;
      worker.terminate();
      worker = null;
    }

    function run(request, onMessage, timeoutMs) {
      const id = (sequence += 1);
      const active = ensure();

      return new Promise(function (resolve) {
        const timer = setTimeout(function () {
          cleanup();
          kill();
          resolve(timeoutResult(timeoutMs));
        }, timeoutMs);

        function cleanup() {
          clearTimeout(timer);
          active.removeEventListener('message', handle);
        }

        function handle(event) {
          const message = event.data || {};
          if (message.id !== id) return;
          if (message.type === 'done') {
            cleanup();
            resolve(message.result);
            return;
          }
          onMessage(message);
        }

        active.addEventListener('message', handle);
        active.postMessage({ type: 'run', id: id, request: request });
      });
    }

    return { name: 'worker', enforcesTimeout: true, run: run, dispose: kill };
  }

  function timeoutResult(timeoutMs) {
    return {
      ok: false,
      stage: 'timeout',
      timedOut: true,
      error: { name: 'Timeout', message: 'run exceeded ' + timeoutMs + ' ms and was terminated', stack: '' },
      tests: [],
      passedCount: 0,
      total: 0,
      logs: [],
      metrics: {},
      durationMs: timeoutMs
    };
  }

  function pickBackend(settings) {
    if (settings.backend) return settings.backend;
    const canUseWorker = typeof Worker !== 'undefined' && typeof window !== 'undefined'
      && window.location && window.location.protocol !== 'file:';
    if (!canUseWorker) return createInlineBackend(settings);
    try {
      return createWorkerBackend(settings);
    } catch (error) {
      return createInlineBackend(settings);
    }
  }

  function createRunner(options) {
    const settings = options || {};
    const backend = pickBackend(settings);
    const defaultTimeout = settings.timeoutMs || DEFAULT_TIMEOUT;

    function run(request, handlers) {
      const hooks = handlers || {};
      const timeoutMs = request.timeoutMs || defaultTimeout;

      function onMessage(message) {
        if (message.type === 'log' && hooks.onLog) hooks.onLog(message);
        if (message.type === 'test' && hooks.onTest) hooks.onTest(message.result);
        if (message.type === 'metric' && hooks.onMetric) hooks.onMetric(message);
      }

      return backend.run(request, onMessage, timeoutMs).then(function (result) {
        if (hooks.onDone) hooks.onDone(result);
        return result;
      });
    }

    return {
      run: run,
      backendName: backend.name,
      enforcesTimeout: backend.enforcesTimeout,
      dispose: function () { backend.dispose(); }
    };
  }

  return {
    createRunner: createRunner,
    createWorkerBackend: createWorkerBackend,
    createInlineBackend: createInlineBackend
  };
}));

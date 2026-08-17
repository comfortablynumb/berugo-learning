/**
 * Sandbox - the execution core shared by the worker runtime and the inline
 * backend, so both honour exactly the same protocol and semantics.
 *
 * Learner code is compiled with `new Function`, not `eval`, so it cannot see
 * the enclosing scope. It receives four capabilities and nothing else: `log`,
 * a seeded `rng`, the instrumented `ops` counters and `assert`.
 *
 * Graded tests arrive as source text (a test is required to be self-contained,
 * because it is serialised across a worker boundary) and are rebuilt here.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Sandbox = api;
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : null), function (scope) {
  'use strict';

  const deps = resolveDeps(scope);

  function resolveDeps(host) {
    if (host && host.Random && host.Assert && host.Ops) {
      return { Random: host.Random, Assert: host.Assert, Ops: host.Ops };
    }
    if (typeof require === 'function') {
      return {
        Random: require('../utils/random.js'),
        Assert: require('../utils/assert.js'),
        Ops: require('../utils/ops-counter.js')
      };
    }
    throw new Error('Sandbox: Random, Assert and Ops must be loaded first');
  }

  const now = (typeof performance !== 'undefined' && performance.now)
    ? function () { return performance.now(); }
    : function () { return Date.now(); };

  function formatArg(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.name + ': ' + value.message;
    try { return deps.Assert.show(value); } catch (error) { return String(value); }
  }

  function describeError(error) {
    if (!error) return null;
    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: typeof error.stack === 'string' ? error.stack.split('\n').slice(0, 4).join('\n') : ''
    };
  }

  function makeLogger(emit) {
    const lines = [];
    function write(level, args) {
      const text = Array.prototype.map.call(args, formatArg).join(' ');
      lines.push({ level: level, text: text });
      emit({ type: 'log', level: level, text: text });
    }
    const logger = function () { write('log', arguments); };
    logger.warn = function () { write('warn', arguments); };
    logger.error = function () { write('error', arguments); };
    logger.lines = lines;
    return logger;
  }

  /*
   * Host globals that learner code has no business touching. They are declared
   * as parameters and left unbound, which shadows them inside the compiled
   * function.
   *
   * This is hygiene, not a security boundary: `globalThis` still reaches
   * everything, and closing that hole would need a parser. The real boundary
   * is the worker, which has no page, no storage and no DOM to reach. The
   * inline backend runs in the host realm and says so in its warnings.
   */
  const SHADOWED = [
    'require', 'module', 'exports', 'process', 'global',
    'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts'
  ];
  // Note: `eval` and `arguments` cannot be shadowed - naming a strict-mode
  // parameter either of those is a SyntaxError, which would break every compile.

  function compile(request, capabilities) {
    const entry = request.entry;
    const tail = entry
      ? '\n;return typeof ' + entry + ' !== "undefined" ? ' + entry + ' : undefined;'
      : '\n;return undefined;';
    const params = ['log', 'rng', 'ops', 'assert'].concat(SHADOWED);
    const factory = new Function(params.join(','), '"use strict";\n' + String(request.code || '') + tail);
    return factory(capabilities.log, capabilities.rng, capabilities.ops, capabilities.assert);
  }

  function buildTest(source) {
    return new Function('return (' + source + ');')();
  }

  function runTests(tests, target, capabilities, emit) {
    return tests.map(function (spec, position) {
      const started = now();
      const api = {
        assert: capabilities.assert,
        ops: capabilities.ops,
        log: capabilities.log,
        rng: deps.Random.seeded(capabilities.seed + position + 1),
        Random: deps.Random
      };

      try {
        const testFn = buildTest(spec.src);
        testFn(target, api);
        const outcome = { name: spec.name, passed: true, durationMs: now() - started };
        emit({ type: 'test', result: outcome });
        return outcome;
      } catch (error) {
        const outcome = {
          name: spec.name,
          passed: false,
          message: (error && error.message) || String(error),
          durationMs: now() - started
        };
        emit({ type: 'test', result: outcome });
        return outcome;
      }
    });
  }

  function execute(request, emitter) {
    const emit = emitter || function () {};
    const seed = Number.isFinite(request.seed) ? request.seed : 1;
    const log = makeLogger(emit);
    const capabilities = {
      log: log,
      rng: deps.Random.seeded(seed),
      ops: deps.Ops.createOps({ limit: request.opsLimit }),
      assert: deps.Assert,
      seed: seed
    };

    const started = now();
    let target;

    try {
      target = compile(request, capabilities);
    } catch (error) {
      return finish(request, capabilities, log, started, {
        ok: false, error: describeError(error), stage: 'compile', tests: []
      });
    }

    if (request.entry && typeof target !== 'function') {
      return finish(request, capabilities, log, started, {
        ok: false,
        stage: 'entry',
        error: { name: 'MissingEntry', message: 'define a function named ' + request.entry, stack: '' },
        tests: []
      });
    }

    return runStage(request, capabilities, log, started, target, emit);
  }

  function runStage(request, capabilities, log, started, target, emit) {
    const tests = Array.isArray(request.tests) ? request.tests : [];
    let value;

    try {
      if (request.mode !== 'grade' && typeof target === 'function') {
        value = target.apply(null, request.args || []);
        if (value !== undefined) log('→', value);
      }
    } catch (error) {
      return finish(request, capabilities, log, started, {
        ok: false, stage: 'run', error: describeError(error), tests: []
      });
    }

    let results = [];
    try {
      results = tests.length ? runTests(tests, target, capabilities, emit) : [];
    } catch (error) {
      return finish(request, capabilities, log, started, {
        ok: false, stage: 'harness', error: describeError(error), tests: results
      });
    }

    const passedCount = results.filter(function (r) { return r.passed; }).length;
    return finish(request, capabilities, log, started, {
      ok: results.length === 0 ? true : passedCount === results.length,
      stage: 'complete',
      value: value === undefined ? undefined : formatArg(value),
      tests: results,
      passedCount: passedCount,
      total: results.length
    });
  }

  function finish(request, capabilities, log, started, partial) {
    return Object.assign({
      ok: false,
      stage: 'complete',
      tests: [],
      passedCount: 0,
      total: 0,
      logs: log.lines,
      metrics: capabilities.ops.snapshot(),
      seed: capabilities.seed,
      durationMs: now() - started
    }, partial);
  }

  return { execute: execute, describeError: describeError };
}));

'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { createState } = require('../../src/js/core/state.js');
const { createSectionRegistry } = require('../../src/js/core/section-registry.js');
const { createStorage, createMemoryStorage } = require('../../src/js/core/storage-adapter.js');
const { createProgress } = require('../../src/js/core/progress.js');
const { createThemeManager } = require('../../src/js/core/theme.js');
const { createLazyLib } = require('../../src/js/core/lazy-lib.js');

function memoryStorage() {
  return createStorage({ backend: createMemoryStorage(), prefix: 'test:' });
}

test('state: subscribers receive emissions and can unsubscribe', function () {
  const state = createState();
  const seen = [];
  const off = state.subscribe('navigation', function (payload) { seen.push(payload.section); });

  state.emit('navigation', { section: 'a' });
  off();
  state.emit('navigation', { section: 'b' });

  assert.deepStrictEqual(seen, ['a']);
  assert.strictEqual(state.listenerCount('navigation'), 0);
});

test('state: set writes nested paths and emits a scoped change event', function () {
  const state = createState();
  let observed = null;
  state.subscribe('change:demo.count', function (payload) { observed = payload; });

  state.set('demo.count', 3);

  assert.strictEqual(state.get('demo.count'), 3);
  assert.deepStrictEqual(observed, { previous: undefined, value: 3 });
  assert.strictEqual(state.get('missing.path'), undefined);
});

test('registry: duplicate ids throw at registration', function () {
  const registry = createSectionRegistry();
  registry.register({ id: 'one', init: function () {} });

  assert.throws(function () { registry.register({ id: 'one', init: function () {} }); }, /Duplicate/);
  assert.throws(function () { registry.register({ id: 'two' }); }, /no init function/);
  assert.throws(function () { registry.register(null); }, /requires/);
});

test('registry: initAll runs every section and collects failures without stopping', function () {
  const registry = createSectionRegistry();
  const ran = [];

  registry.register({ id: 'ok', init: function () { ran.push('ok'); } });
  registry.register({ id: 'bad', init: function () { throw new Error('boom'); } });
  registry.register({ id: 'after', init: function () { ran.push('after'); } });

  const failures = registry.initAll({});

  assert.deepStrictEqual(ran, ['ok', 'after'], 'a failing section does not stop the others');
  assert.strictEqual(failures.length, 1);
  assert.strictEqual(failures[0].id, 'bad');
});

test('storage: survives a backend that throws, without propagating', function () {
  const hostile = {
    getItem: function () { throw new Error('denied'); },
    setItem: function () { throw new Error('quota'); },
    removeItem: function () { throw new Error('denied'); },
    key: function () { return null; },
    length: 0
  };
  const storage = createStorage({ backend: hostile });

  assert.strictEqual(storage.read('k', 'fallback'), 'fallback');
  assert.strictEqual(storage.write('k', 1), false);
  assert.strictEqual(storage.remove('k'), false);
});

test('storage: round-trips values and lists only its own keys', function () {
  const backend = createMemoryStorage();
  backend.setItem('other:key', '1');
  const storage = createStorage({ backend: backend, prefix: 'test:' });

  storage.write('a', { n: 1 });
  assert.deepStrictEqual(storage.read('a', null), { n: 1 });
  assert.deepStrictEqual(storage.keys(), ['a']);

  storage.remove('a');
  assert.strictEqual(storage.read('a', null), null);
});

test('progress: visited and done are distinct, and done needs every lab', function () {
  const labs = { alpha: ['one', 'two'] };
  const progress = createProgress({
    storage: memoryStorage(),
    labIdsFor: function (id) { return labs[id] || []; }
  });

  assert.strictEqual(progress.statusOf('alpha'), 'unvisited');

  progress.markVisited('alpha');
  assert.strictEqual(progress.statusOf('alpha'), 'visited');

  progress.recordLab('alpha', 'one', { passed: true, total: 3, passedCount: 3 });
  assert.strictEqual(progress.statusOf('alpha'), 'visited', 'one of two labs is not done');

  progress.recordLab('alpha', 'two', { passed: true, total: 2, passedCount: 2 });
  assert.strictEqual(progress.statusOf('alpha'), 'done');
});

test('progress: a section with no labs never claims to be done', function () {
  const progress = createProgress({ storage: memoryStorage(), labIdsFor: function () { return []; } });
  progress.markVisited('page');
  assert.strictEqual(progress.statusOf('page'), 'visited');
});

test('progress: a pass is sticky but the last attempt is still recorded', function () {
  const progress = createProgress({ storage: memoryStorage(), labIdsFor: function () { return ['one']; } });

  progress.recordLab('alpha', 'one', { passed: true, total: 2, passedCount: 2 });
  progress.recordLab('alpha', 'one', { passed: false, total: 2, passedCount: 1 });

  const result = progress.labResult('alpha', 'one');
  assert.strictEqual(result.passed, true, 'a passed lab stays passed');
  assert.strictEqual(result.lastPassed, false, 'the latest attempt is visible');
  assert.strictEqual(result.attempts, 2);
});

test('progress: export and import round-trip exactly', function () {
  const progress = createProgress({ storage: memoryStorage(), labIdsFor: function () { return ['one']; } });
  progress.markVisited('alpha');
  progress.recordLab('alpha', 'one', { passed: true, total: 1, passedCount: 1 });

  const exported = progress.exportAll();
  const fresh = createProgress({ storage: memoryStorage(), labIdsFor: function () { return ['one']; } });
  fresh.importAll(JSON.parse(JSON.stringify(exported)));

  assert.deepStrictEqual(fresh.exportAll(), exported);
});

test('progress: reset clears one section without touching the others', function () {
  const progress = createProgress({ storage: memoryStorage(), labIdsFor: function () { return ['one']; } });
  progress.markVisited('alpha');
  progress.markVisited('beta');
  progress.recordLab('alpha', 'one', { passed: true, total: 1, passedCount: 1 });

  progress.reset('alpha');

  assert.strictEqual(progress.statusOf('alpha'), 'unvisited');
  assert.strictEqual(progress.labResult('alpha', 'one'), null);
  assert.strictEqual(progress.statusOf('beta'), 'visited');
});

test('theme: an explicit choice beats the system preference and persists', function () {
  const storage = memoryStorage();
  const documentDouble = { documentElement: { attributes: {}, setAttribute: function (k, v) { this.attributes[k] = v; } } };
  const events = [];

  const theme = createThemeManager({
    storage: storage,
    document: documentDouble,
    prefersDark: function () { return true; },
    emit: function (name, payload) { events.push([name, payload.theme]); }
  });

  assert.strictEqual(theme.init(), 'dark', 'system preference is the default');
  assert.strictEqual(theme.toggle(), 'light');
  assert.strictEqual(documentDouble.documentElement.attributes['data-theme'], 'light');
  assert.deepStrictEqual(events, [['theme', 'dark'], ['theme', 'light']]);

  const reopened = createThemeManager({
    storage: storage,
    document: documentDouble,
    prefersDark: function () { return true; }
  });
  assert.strictEqual(reopened.init(), 'light', 'the stored choice wins on the next visit');
});

test('lazyLib: concurrent requests load the script exactly once', async function () {
  const host = {};
  const added = [];
  const documentDouble = {
    createElement: function () { return {}; },
    head: {
      appendChild: function (tag) {
        added.push(tag.src);
        host.d3 = { version: '7' };
        setTimeout(function () { tag.onload(); }, 0);
      }
    }
  };

  const lazy = createLazyLib({ document: documentDouble, global: host });
  const [a, b] = await Promise.all([lazy.d3(), lazy.d3()]);

  assert.strictEqual(a, b);
  assert.strictEqual(added.length, 1, 'one script tag for two concurrent requests');
  assert.strictEqual(lazy.loadCount('d3'), 1);

  await lazy.d3();
  assert.strictEqual(added.length, 1, 'a later request reuses the loaded global');
});
